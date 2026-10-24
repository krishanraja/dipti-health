# API contract

## App API (Vercel, same origin, cookie auth)

- `POST /api/login {code, persona?}`
  - Checks `DIPTI_CODE` (opens as `dipti`) or `ACCESS_CODE` (opens as `family`). Both are case-insensitive.
  - Sets `dipti_session` (HttpOnly, Secure, 30 days). Each `GET /api/session` (every app open) renews the 30 days.
  - Returns `{role, askWho, people}`.
  - `POST /api/login {persona: 'dipti'|'family'}` switches a logged-in device. `DELETE /api/login` logs out.
- `GET /api/session` returns `{authed, role, sheetConfigured, ai, people}`, or 401 when not logged in.
- `GET /api/canon` returns the whole Sheet in the shape below. Chat notes come without their stored DATA.
- `POST /api/write {action, payload, by, opId}` proxies one Sheet write. A Dipti session is always written as "Dipti". `opId` is made once per write and kept across retries. Returns 422 `{rejected: true}` when the Sheet refuses the content (do not retry), 409 `{outdated: true}` when the Sheet's script is older than the app (keep it queued until the script is updated), and 502 when the Sheet cannot be reached (retry later).
- `POST /api/ask {message, thread[{role, text}], threadId, rid, by, image?{data, type}}` streams NDJSON:
  - `stage`, then `delta` events with the reply text, then one `answer`, then `learned`.
  - `answer` is `{urgency, reply, doNow[], watchFor[], askTheDoctor[], evidence[{point, ref, title, url, grade}], usedFromRecord[], replies[], learned[], results[], limits}`.
- `GET /api/answer?rid=` recovers a reply the device missed.
- `POST /api/note {draft, parts}` returns `{text}`: a warmer wording of her note to a doctor, or the draft unchanged if the rewrite added anything (`lib/note.js`).
- `GET /api/status` returns `{ok, version, current, missing[]}`: whether the Sheet's script is the one this app expects.
- `POST /api/photo {image}` returns `{kind, summary, unreadable, results[{date, test, result, range, lab, notes, duplicate, dateGuessed}]}`. It saves nothing.

## Sheet API (Apps Script, server to server only)

- **URL:** Vercel env `SHEET_API_URL`.
- **Auth:** `secret`, sent as a query parameter on GET or a body field on POST. It must equal the script property `APP_SECRET`, which `setup()` creates.
- **Source of truth:** `apps-script/Code.gs` (`TABS`).

Endpoints:

- `GET ?secret=..&action=ping|read`. `ping` returns `{version, actions[]}`.
- `GET ?secret=..&action=journal&jid=` returns the full text of one long note.
- `GET ?secret=..&action=answer&rid=` returns `{ok, data}` for one saved chat reply (`_Chats` first, then old Notes DATA).
- `POST` (`Content-Type: text/plain`) `{secret, action, by, payload, opId?}`. Every POST runs under a script lock. With an `opId` already in `_Ops`, the stored result comes back with `duplicate: true` and nothing is written again. Actions:
  - `checkin {answers:{tooth 0-10, abdomen 0-10, fatigue 0-10, sleep good|ok|poor, bowels normal|loose|diarrhoea|constipated, mood ok|low|very-low}, notes?}`. Returns a verdict: `Steady`, `Changed` or `Act-today`. `Act-today` means diarrhoea (steroid sick-day rules) or pain of 9 or more.
  - `note {text, tag?}`
  - `testResult {date, test, result, range?, lab?, notes?}`
  - `question {id?, question?, askWhom?, priority?, status open|asked|answered?, answer?}`
  - `gap {id?, gap?, whatAnswersIt?, stepToClose?, status open|in-progress|closed?}`
  - `priority {id?, title?, rank?, status now|waiting|better|done?, why?, plan?, nextStep?, askWhom?}`
  - `clinician {name, role?, owns?, contact?, lastSeen?, notes?}`
  - `appointment {id?, date YYYY-MM-DD?, time?, with?, where?, for?, status booked|done|moved|cancelled?, notes?, checked?}`: a new one needs `date` and `with`; with `id` it updates that row.
  - `check {tab Medications|Priorities|Appointments, key}`: the fact checker's "still right". Sets `CheckedAt` to today and logs it. `key` is the medicine name or the row id.
  - Any of `medication`, `priority` or `appointment` with `checked: true` also sets `CheckedAt` (a change made from a fact check counts as checked).
  - `profile {key, value}`
  - `condition {name, status long-term|watching|settled?, notes?, since?, evidence?, aliases?, plain?}`
  - `medication {name, generic?, dose?, timing?, rx?, purpose?, status current|stopped|check?}`
  - `journal {jid, text}`: a long note. Full text (up to 45,000 characters) to `_Journal` (`Jid, TimestampUTC, By, Text`); Notes gets the first 400 characters and `JID: …`, tag `journal`.
  - `feedback {chip, text?, screen?}`: one row in `Feedback` (`TimestampUTC, By, Chip, Text, Screen, Status`), status `new`.
  - `chat {rid, threadId?, text, data}`: server only (`/api/ask`). Full data to `_Chats` (`Rid, TimestampUTC, By, ThreadId, Data`); a short concern row to Notes.

Hidden tabs: `_Ops` (`OpId, TimestampUTC, Action, Result`, last 2,000 kept), `_Chats` and `_Journal`. Neither is returned by `read`.

Every edit to an overwrite tab is written to `Changelog` with who made it.

Columns are found by their header text in row 1, not by position. `setup()` adds any header in `TABS` that a tab is missing, at the end.

## Fact checker

- `Appointments` tab: `ID, Date, Time, With, Where, For, Status, Notes, UpdatedAt, CheckedAt`.
- `CheckedAt` on `Medications`, `Priorities` and `Appointments`: the last day she said the row is still right. A row comes up for checking again after 7 days (`public/js/facts-model.js`).
- `POST /api/ask` answers may carry `updates[{kind, action, say, payload}]`: changes Ellie heard in the message, already checked on the server (`lib/updates.js`). The app writes one only when she taps Yes.

## Tabs added for Conditions

- `Conditions`: `Key` (the research pack id, e.g. `COND_X`), `AlsoCalled` (other names separated by `;`, the first one is the short name used on screen), `Plain` (one calm sentence on what it is). `Status` groups the tab: `long-term`, `watching` or `settled` (`active` and `resolved` are read as watching and settled).
- `Evidence`: `Plain` (for an interaction: what the link means for her, in plain words; for a medicine, result or symptom row: its everyday name) and `AskPlain` (the question in her own words). Rows of kind `name` only give an everyday name to an id that has no row of its own.
- Two things are linked on the Conditions map when one `interaction` row names both in `Entities`. Rows of kind `symptom_attribution` (lists of possible causes) never make links.

## Note tags

| Tag | Format |
|---|---|
| `symptom-log` | `SYMPTOM: … \nDATA: {symptom, when, severity, note, level}` |
| `meds-taken` | `MEDS: taken` |
| `dipti-says` | Free text in her own words |
| `fact` | `FACT: …` or `FACT REMOVED: …` (the knowledge bank) |
| `concern` | A chat exchange, with `RID` and `DATA` |
| `record` | Seeded history: `REPORTED: …` or `MEDICINE CHANGE: …` |
