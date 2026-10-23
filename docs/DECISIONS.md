# Decisions

Append-mostly. Newest first. Each one gives the decision, who made it, and why.

## 2026-10-23: first build

| # | Decision | By | Why / carry-forward |
|---|---|---|---|
| D1 | Dipti is the main user. Krish can also sign in, and every entry is credited to its author | Krish | Two codes: `DIPTI_CODE` and `ACCESS_CODE` |
| D2 | The canon Sheet is owned by Krish's Google account and shared with Dipti as an editor | Krish | Krish can always repair it |
| D3 | Tone is calm and proportionate: one worry level and one next step, no lists of possible diagnoses, never mention anxiety, never under-call a red flag | Krish | Enforced in `api/ask.js` (prompt), `public/js/triage.js` (rules floor), `dipti-model.js` (`repeatAsk`), and the dashboard (cause lists hidden) |
| D4 | AI matches Kimon's app: Claude through the Vercel AI Gateway for chat, OpenAI for voice only | Krish | `OPENAI_API_KEY` is used for transcription only |
| D5 | The repo is public, so all personal data lives in the Sheet, including the research pack (Evidence and Sources tabs). The repo holds code plus general evidence only | Krish | A PII grep runs before every push |
| D6 | No mock gate. Build end to end inside Kimon's design system; Krish reviews the working preview | Krish | Material redesigns after this follow the normal gate |
| D7 | Persona is a young English doctor, "Dr Ellie" | Krish (confirmed 23 Oct) | One constant: `public/js/persona.js` |
| D8 | Major difference from Kimon: a fuller desktop overview at 1024 px and wider | Krish | `public/js/dashboard.js` |
| D9 | App name is "Steady" | Krish (confirmed 23 Oct) | Brand strings in `public/index.html` and `manifest.webmanifest` |
| D11 | Icon and favicon: a warm sun held in a soft embrace, on the teal accent. Abstract shapes, no face | Claude, after Krish asked for a friendly icon | Chosen from three drawn options because it reads clearly at 16 px. Files: `public/icon.svg` and the PNGs generated from it |
| D10 | The research pack is shown as "Worth asking: …" questions, with the technical detail behind a tap | Claude, after a real-data render showed alarming titles | Keeps proportion without hiding evidence |
