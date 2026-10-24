# Decisions

Append-mostly. Newest first. Each one gives the decision, who made it, and why.

## 2026-10-24: design system v2, map on phones, Sheet integrity, Feedback

| # | Decision | By | Why / carry-forward |
|---|---|---|---|
| D22 | Design system v2 (`public/ds.css`, loaded last): fills not borders, one button family (`.btn`, `.primary`, `.tinted`, `.quiet`), a 2×2 status picker, a pill toast, sheets with a close button and swipe-down | Krish asked for it 10x after an on-device review; approved from screenshots | Fix the system, not one screen at a time |
| D23 | The Conditions map is two columns around the condition, not a circle. Kind chips always filter. On a phone a tapped dot opens a sheet with previous and next; wide screens keep the inline card | Krish (the problem), Claude (the layout); approved from screenshots | A circle could not hold 12 labels on a phone. Every label gets its own row of at least 30 px; if "All" cannot, the map opens on the biggest kind |
| D24 | Every write carries an `opId`. Code.gs records it in a hidden `_Ops` tab and applies each op once; all writes run under a script lock | Claude, after an audit Krish asked for | Offline replays duplicated rows, and two devices could take the same ID. `_Ops` keeps its last 2,000 rows and is the only tab ever trimmed. Nothing deletes her data |
| D25 | A write the Sheet refuses (bad id, bad value) returns 422 and leaves the offline queue with a message; only network or server failures are retried | Claude | A refused write used to retry forever and keep "waiting to save" on screen |
| D26 | Full chat replies live in a hidden `_Chats` tab. Notes keep the short form only, and reads strip old DATA | Claude | Each chat put up to 40,000 characters into Notes, which every read returned, so reads slowed as chats piled up |
| D27 | Ellie's read-aloud is removed | Krish | Not needed |
| D29 | The app is renamed Holistic (was Steady). Check-in results keep the word "Steady" | Krish | Brand strings in `public/index.html` and `manifest.webmanifest`; D9 is replaced |
| D28 | A fifth tab, Feedback: one tap on a chip, an optional note (typed or spoken), saved to a `Feedback` tab with the screen she came from. The Ask tab is now "Ask Ellie" so five labels fit at 320 px | Krish (the tab), Claude (chips and copy); approved from screenshots | `Status` starts as `new` so Krish can work through them |

## 2026-10-23 (evening): the fact checker

| # | Decision | By | Why / carry-forward |
|---|---|---|---|
| D18 | A fact checker: a few "still right?" checks a day on Today and the overview, not a weekly review | Krish | Her medicines, symptoms and appointments change a lot. Small and daily keeps the Sheet true without a chore. Every answer is something she adds herself, which is the North Star |
| D19 | New Appointments tab; `CheckedAt` on medicines, priorities and appointments; 7 days until a fact is due again; past booked appointments first | Krish (tab), Claude (rules) | `public/js/facts-model.js` holds the order and is unit tested |
| D20 | In chat, Ellie proposes Sheet updates and she confirms. Nothing is written without a tap | Krish | `lib/updates.js` drops anything she did not report, unknown rows, and anything but recording a change she made. Ellie never suggests changing a medicine |
| D21 | Built without a mock | Krish | Inside the existing design system; reviewed in the working preview |

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
