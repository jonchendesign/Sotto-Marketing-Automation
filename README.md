# Sotto

SMS campaigns that write themselves. You describe what you want; Sotto drafts the plan, the copy, and the flow. You review and ship.

---

## What it does

- **Campaigns** — Start with a short brief (goal, audience, constraints). Sotto proposes audiences, message copy, and a send sequence. You edit in plain language or tweak the flow.
- **Plan** — One-page summary: who it’s for, core idea, how often we message, what happens if they don’t respond, when we stop, and sample messages. No jargon.
- **Preview** — See what contacts get in different scenarios (they engage, they ignore, they buy).
- **Flow** — The actual sequence (trigger → messages → waits → exits). Pin steps you want to keep; ask Sotto to redraft around them.
- **Rules** — Global and per-audience guardrails (frequency, quiet hours, who we never message). Shown in plain language with an optional “view as logic” for the technical side.
- **Knowledge base** — Upload brand voice, offer rules, and compliance notes. Sotto uses this when drafting so campaigns sound like you and stay in bounds.

Positioning: professional, credible, modern. Clear value; no filler.

---

## Run it

```bash
npm install
cp .env.example .env   # add GEMINI_API_KEY
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3001 (proxied at `/api`)

Without a Gemini API key, the app loads but draft/revise/redraft calls will fail.

---

## Stack

React 18, TypeScript, Vite, react-router-dom. Express server for Gemini. Data stored in localStorage for the prototype.
