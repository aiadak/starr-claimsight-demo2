# Starr ClaimSight — Deployment Package

An agentic claims-intelligence prototype for Starr Re. The flagship
**Catastrophic Claims** agent is powered by the Anthropic API (Claude), with a
built-in fallback so the app still works before you add a key.

## What's in this folder
```
index.html            the whole front-end (single file)
vercel.json           static-site config
.env.example          the environment variables to set in Vercel
api/
  health.js           reports whether the key is configured (no secrets returned)
  classify.js         calls Claude to classify a claim's notes
  chat.js             powers the "Ask ClaimSight" assistant
sample-data/          33 demo claims (CSV + JSON) to upload in the app
README.md             this file
```

## Two modes (automatic)
- **Demo mode (no key):** the agent runs a rule-based classifier in the browser,
  and the chat gives template summaries. Nothing to configure — good for a quick look.
- **Live mode (key set):** the flagship agent and the chat call **Claude** through the
  serverless functions in `/api`. This is the real, agentic experience.

The app detects which mode it's in and shows it next to "Ask ClaimSight"
(green "Claude connected" vs grey "Demo mode").

## Deploy to Vercel

### If you deploy from GitHub (recommended)
1. Put the **entire contents of this folder** (including the `api/` folder) into your repo.
2. In Vercel: **Project → Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic key (starts with `sk-ant-...`)
   - `ANTHROPIC_MODEL` = `claude-sonnet-5`  *(optional — see options below)*
3. **Redeploy** (Deployments → ⋯ → Redeploy, or push a new commit). Env-var
   changes only take effect on a new deployment.

### If you deploy with the Vercel CLI
1. `cd` into this folder, run `vercel` (Framework preset: **Other**).
2. Add the env vars:  
   `vercel env add ANTHROPIC_API_KEY`  (paste the key)  
   `vercel env add ANTHROPIC_MODEL`  (type `claude-sonnet-5`)
3. `vercel --prod` to publish.

### Settings
- Framework preset: **Other**. No build command. Root directory: the folder root.
- Vercel automatically runs `api/*.js` as serverless functions — no extra config.

## Model options (`ANTHROPIC_MODEL`)
- `claude-haiku-4-5`  — fastest / lowest cost
- `claude-sonnet-5`   — balanced (default)
- `claude-opus-4-8`   — highest quality

## Security
Your API key lives **only** in Vercel's environment variables and is used
server-side inside `/api`. It is never sent to the browser and never appears in
`index.html`. Do not paste the key into the HTML or commit it to GitHub.

## What it demonstrates (full lifecycle)
The **Solution Architecture** page maps the target Azure build
(Fabric/ADF → Azure AI Search hybrid → Azure OpenAI RAG → confidence routing →
Azure AI Foundry evals → feedback loop; Power BI monitoring; Purview + Entra
governance) onto what the live agent actually does. On the **Catastrophic Claims**
page, each run shows the same lifecycle end-to-end:
1. **Retrieve · RAG** — hybrid keyword+vector match over notes + guidelines
2. **Reason** — Claude classifies with evidence, categories and a confidence score
3. **Route** — high → auto-flag, medium → human review queue, low → standard flow
4. **Evaluate** — Precision / Recall / F1 vs a golden set
5. **Improve** — Agree / Override feedback captured to tune retrieval & prompts

## Using it in the demo
Open your URL → **Catastrophic Claims** → **Load demo dataset** (or drag
`sample-data/claims_synthetic.csv` onto the upload box) → pick a claim → **Run agent
analysis**. "Ask ClaimSight" will summarize the determination, explain the reasons,
suggest next steps, and answer your questions. File upload works on the deployed URL
(not inside in-app previews).

## Next step
When you're ready to point the agent at a **Starr claims API** instead of (or in
addition to) the Anthropic API, we extend `/api/classify.js` to pull the notes from
your endpoint — a small, contained change.
