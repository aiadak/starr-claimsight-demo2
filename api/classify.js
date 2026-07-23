// POST /api/classify  { notes }  ->  { configured, model, result }
// Calls the Anthropic Messages API server-side. The API key lives only in
// process.env.ANTHROPIC_API_KEY (set in Vercel), never in the browser.

const SYSTEM = `You are ClaimSight, a reinsurance claims classifier for Starr Re. Read the claim's loss description / notes and decide whether it is a catastrophic "seven deadly sins" claim.

You are grounded in the retrieved classification guidelines below (in production these are retrieved per-claim via hybrid keyword + vector search over the guideline corpus — Azure AI Search). Classify strictly against them.

The seven catastrophic categories (use these exact keys): death, tbi, spine, amp, burn, blind, frac.
- death = Death / Fatality
- tbi = Traumatic Brain Injury
- spine = Spinal Cord / Paralysis
- amp = Amputation / Loss of Limb
- burn = Severe Burns
- blind = Blindness / Loss of Sight
- frac = Multiple Fractures / Disfigurement

Rules:
- A claim QUALIFIES only if a catastrophic injury actually occurred to a person.
- Discard non-injury keyword matches (e.g. "dead battery", "dead-man switch", "dead animal/raccoon/deer", "deadline", "dead-weight", "dead end") — these are false positives, mark them as evidence type "dismiss".
- If a catastrophic injury was contemplated or feared but avoided or still unresolved (e.g. "possible amputation but digits saved", "ruled out spinal injury", ongoing monitoring), set verdict to "review" (not "qualify"), and mark that evidence type "contemplated".
- Minor injuries (single simple fracture, first-degree burn, soft tissue, treated-and-released) do NOT qualify.

Return ONLY minified JSON, no prose, no markdown, with exactly this shape:
{"verdict":"qualify|review|clear","confidence":0,"categories":[{"key":"amp","label":"Amputation / Loss of Limb"}],"evidence":[{"text":"verbatim substring from the notes","type":"confirm|dismiss|contemplated","category":"amp","reason":"max 12 words"}],"summary":"1-2 plain-language sentences","recommendation":"1 sentence next action"}

- confidence is an integer 0-100.
- categories: include ONLY confirmed catastrophic categories (empty array if none).
- evidence.text MUST be copied verbatim (exact characters) from the notes so the UI can highlight it.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  if (!key) { res.status(200).json({ configured: false }); return; }
  try {
    const body = await readJson(req);
    const notes = (body.notes || '').toString().slice(0, 8000);
    if (!notes.trim()) { res.status(400).json({ configured: true, error: 'no notes' }); return; }

    const ar = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model, max_tokens: 1024, temperature: 0, system: SYSTEM,
        messages: [{ role: 'user', content: 'Claim notes:\n"""\n' + notes + '\n"""' }]
      })
    });
    if (!ar.ok) {
      const t = await ar.text();
      res.status(502).json({ configured: true, error: 'anthropic_error', status: ar.status, detail: t.slice(0, 400) });
      return;
    }
    const data = await ar.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';
    const result = extractJson(text);
    if (!result) { res.status(502).json({ configured: true, error: 'parse_error', raw: text.slice(0, 400) }); return; }
    res.status(200).json({ configured: true, model, result });
  } catch (e) {
    res.status(500).json({ configured: true, error: String((e && e.message) || e) });
  }
};

function readJson(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') { resolve(req.body); return; }
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function extractJson(t) {
  if (!t) return null;
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e < 0) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch (_) { return null; }
}
