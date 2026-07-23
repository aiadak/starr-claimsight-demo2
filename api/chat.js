// POST /api/chat  { mode:'summary'|'ask', question, context }  ->  { configured, model, reply }
// Powers the "Ask ClaimSight" assistant. Key stays server-side.

const SYSTEM = `You are ClaimSight, an AI assistant for Starr Re reinsurance claims analysts. You help them understand catastrophic-claim ("seven deadly sins") determinations and decide next steps.

Guidance:
- Ground every answer in the provided claim notes and analysis. If the information isn't present, say so rather than inventing it.
- Be concise and specific. Use plain professional language and short paragraphs or tight bullet points.
- When useful, end with a clear recommended next action.
- This is decision support, not legal or medical advice; note when a human adjuster, counsel, or medical reviewer should confirm.
- If asked about the portfolio, use the provided summary counts.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  if (!key) { res.status(200).json({ configured: false }); return; }
  try {
    const body = await readJson(req);
    const mode = body.mode === 'summary' ? 'summary' : 'ask';
    const question = (body.question || '').toString().slice(0, 1000);
    const ctxBlock = buildContext(body.context || {});
    const task = mode === 'summary'
      ? 'Task: In 2-4 sentences, summarize this determination, explain the key reasons behind it, and give a recommended next action.'
      : 'Question: ' + question;
    const user = ctxBlock + '\n\n' + task;

    const ar = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model, max_tokens: 700, temperature: 0.3, system: SYSTEM,
        messages: [{ role: 'user', content: user }]
      })
    });
    if (!ar.ok) {
      const t = await ar.text();
      res.status(502).json({ configured: true, error: 'anthropic_error', status: ar.status, detail: t.slice(0, 400) });
      return;
    }
    const data = await ar.json();
    const reply = (data.content && data.content[0] && data.content[0].text) || '';
    res.status(200).json({ configured: true, model, reply });
  } catch (e) {
    res.status(500).json({ configured: true, error: String((e && e.message) || e) });
  }
};

function buildContext(ctx) {
  let s = 'CONTEXT';
  if (ctx.claim) {
    const c = ctx.claim;
    s += '\nCurrent claim:'
      + '\n- ID: ' + (c.id || '?')
      + '\n- Line of business: ' + (c.line || '?')
      + '\n- Determination: ' + (c.verdict || '?') + ' (' + (c.confidence || '?') + '% confidence)'
      + '\n- Categories: ' + ((c.categories && c.categories.length) ? c.categories.join(', ') : 'none')
      + '\n- Loss notes: """' + (c.notes || '').slice(0, 3000) + '"""';
  } else {
    s += '\nNo individual claim is open yet.';
  }
  if (ctx.portfolio) {
    const p = ctx.portfolio;
    s += '\nPortfolio loaded: ' + p.scanned + ' claims — ' + p.flagged + ' catastrophic, '
      + p.cleared + ' cleared, ' + p.review + ' held for review.';
  }
  return s;
}
function readJson(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') { resolve(req.body); return; }
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
