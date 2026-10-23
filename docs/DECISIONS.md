# Decisions

Append-mostly. Newest first. Each one gives the decision, who made it, and why.

## 2026-10-23 (later): Conditions tab and no-scroll

| # | Decision | By | Why / carry-forward |
|---|---|---|---|
| D12 | A fourth tab, "Conditions": one condition on its own, then how it connects | Krish (mock approved) | She needs to think about each thing in isolation and still see the impact of everything else. `public/js/conditions.js`, `conditions-model.js` |
| D13 | Links on the map come only from the research pack's interaction rows, each told as one plain sentence and one question in her words. Lists of possible causes never become links | Claude, under D3 | Keeps proportion: the map says "these affect each other, ask this", never "this could be X". Plain text lives in the Sheet (`Plain`, `AskPlain`), not the repo |
| D14 | No scrolling on any device, guaranteed by a test | Krish | Long content pages (arrows, swipe, keys) and re-packs on resize: `public/js/pager.js`. The chat thread is the only exception. `scripts/noscroll.mjs` checks 12 sizes and fails on any scroll, clip or off-screen content |
| D15 | Every screen follows one order: what it is, where it stands, one action, then detail behind a tap | Krish ("world class hierarchy") | E.g. the priority sheet shows the next step first, the plan pages below, the actions stay fixed; research detail opens on its own sheet |
| D16 | Code.gs finds columns by header text; `setup()` adds missing columns | Claude | Krish's live Sheet picks up new columns without a re-import, and moving a column by hand cannot break the app |
| D17 | Condition status groups the tab: long-term, watching, settled | Claude | Set in the Sheet's Status column. Long-term is for what she is treated for over years; everything else is being watched until a doctor says otherwise |

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
