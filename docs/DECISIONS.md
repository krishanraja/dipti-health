# Decisions

Append-mostly. Newest first. Each one gives the decision, who made it, and why.

## 2026-10-24 (night): calm by default

Krish: Dipti is prone to health anxiety and rabbit holes. The app should simplify and steady her, never belittle what she feels, and never make her feel she has more wrong than she does. No data is removed.

| # | Decision | By | Why / carry-forward |
|---|---|---|---|
| D38 | Calm by default, depth on request: every screen leads with what is in hand and who is looking after it; detail is one tap deeper, never removed | Krish (the brief and the mock) | Approved from a rendered mock before build |
| D39 | Conditions becomes My care: her conditions grouped into a few areas (teeth, tummy and liver, hormones and energy, joints, heart, mood and sleep, everyday health), each with who looks after it. Only areas tied to a live priority are "being looked into now"; the rest are "known and looked after" | Krish (approved), Claude (areas) | 23 conditions in a flat list read as 23 problems. `public/js/care-model.js`; every condition is in exactly one area (tested) |
| D40 | Statuses only repeat the Sheet: In hand, Waiting, Getting better, Long-term, Looked after, Settled. No link counts on a condition; the map opens on medicines first | Claude | A count of links reads as a count of problems. "Steady" from the mock became "Looked after", because stability is not something the Sheet records |
| D41 | Today shows one step: a sentence on where things stand, today's one step from the first priority (with "Done it"), the others as quiet lines, then the check-in | Krish (approved) | "Done it" records the step in her history and asks what comes next |
| D42 | Record and the overview use words, not big numbers; "things to clear up" is "To tidy up, nothing urgent"; out-of-range results and prescription differences use neutral tones, kept for real red flags only | Claude | Same facts, less alarm |
| D44 | Each care area shows "the story so far": notes about that area, newest first, from the Notes tab (however they got there, including typed into the Sheet) and from each condition's notes; a tap shows the whole note. Taps and chat questions are left out | Krish (fold in her new tooth notes; page too sparse) | `storyFor` in `public/js/care-model.js` |
| D45 | Laptop heights (1366×657, 1440×760, 1280×680) are part of the no-scroll proof; the overview tightens there instead of cutting cards | Krish (cards cut off on his laptop) | Adding a symptom or update lives behind "+ Add" on short screens |
| D43 | Visual: warm paper tones, Newsreader for what she reads, sentence-case labels | Krish (approved mock) | Loaded from Google Fonts with a Georgia fallback, so offline still reads well |

## 2026-10-24 (evening): one input console, notes in her voice, buttons v3

| # | Decision | By | Why / carry-forward |
|---|---|---|---|
| D32 | Buttons have three tiers: primary (solid accent, one per surface), secondary (`.btn`: raised surface, hairline edge, ink text, an icon where it helps) and quiet (text). Labels never wrap | Krish (the ask), Claude (the system) | Mixed tinted and grey buttons that wrapped read as unfinished. Plain `.btn` is the secondary, so every button moved at once |
| D33 | One input console for everything she adds: a round + on Today, Record and Conditions (phones), "+ Add" in the top bar (wide). The long note leads, then how I feel, a symptom, a medicine change, a test result (photo or typed), an appointment, a question, and tablets as a one-tap row | Krish (the + placement), Claude (the contents) | Inputs were scattered, and medicine changes or typed results could only go through chat. `public/js/console.js` |
| D34 | Long notes: "Write or talk it through" takes up to 20,000 characters, typed, spoken or dictated (Wispr Flow), with a draft kept on the device. The full text goes to a hidden `_Journal` tab; Notes keeps the first 400 characters. After saving, Ellie can pick out what should change, and she confirms each one | Krish (the ask), Claude (storage) | Same pattern as `_Chats`, so reads stay small. The editor is the second place allowed to scroll, after the chat thread |
| D35 | A note to a doctor is written by her, in her voice: a greeting, one or two sentences on what it is about, the steroid if she takes one, at most two questions, her name. One tap copies it. Ellie may make the wording warmer but cannot add a number, a question or a fact (`lib/note.js` checks it) | Krish | Replaces the long "health summary", which read as a record dump with up to ten questions |
| D36 | Feedback starts on step 1 after every reload; unsent words come back when she picks a chip again. "Thank you" shows only when the Sheet has it | Krish | |
| D37 | The Sheet script reports its version (`ping`). A write the old script does not know returns 409 and stays queued, never shown as sent; settings shows whether the script is up to date | Claude, after Krish asked that feedback logs correctly | Bump `VERSION` in Code.gs and `SHEET_VERSION` in `api/status.js` together (a test checks they match) |

## 2026-10-24: design system v2, map on phones, Sheet integrity, Feedback

| # | Decision | By | Why / carry-forward |
|---|---|---|---|
| D22 | Design system v2 (`public/ds.css`, loaded last): fills not borders, one button family (`.btn`, `.primary`, `.tinted`, `.quiet`), a 2×2 status picker, a pill toast, sheets with a close button and swipe-down | Krish asked for it 10x after an on-device review; approved from screenshots | Fix the system, not one screen at a time |
| D23 | The Conditions map is two columns around the condition, not a circle. Kind chips always filter. On a phone a tapped dot opens a sheet with previous and next; wide screens keep the inline card | Krish (the problem), Claude (the layout); approved from screenshots | A circle could not hold 12 labels on a phone. Every label gets its own row of at least 30 px; if "All" cannot, the map opens on the biggest kind |
| D24 | Every write carries an `opId`. Code.gs records it in a hidden `_Ops` tab and applies each op once; all writes run under a script lock | Claude, after an audit Krish asked for | Offline replays duplicated rows, and two devices could take the same ID. `_Ops` keeps its last 2,000 rows and is the only tab ever trimmed. Nothing deletes her data |
| D25 | A write the Sheet refuses (bad id, bad value) returns 422 and leaves the offline queue with a message; only network or server failures are retried | Claude | A refused write used to retry forever and keep "waiting to save" on screen |
| D26 | Full chat replies live in a hidden `_Chats` tab. Notes keep the short form only, and reads strip old DATA | Claude | Each chat put up to 40,000 characters into Notes, which every read returned, so reads slowed as chats piled up |
| D27 | Ellie's read-aloud is removed | Krish | Not needed |
| D30 | Wide Conditions: the list is a sidebar that leads; the chosen condition joins one detail panel holding the condition and its map, which redraws when the choice changes | Krish (the ask) | `renderWide` in `public/js/conditions.js`; `.cside` and `.cdetail` in `public/ds.css` |
| D31 | A login lasts 30 days on a device and renews every time the app opens | Krish | `MAX_AGE` in `lib/auth.js`; renewed in `api/session.js`. Was one year, never renewed |
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
