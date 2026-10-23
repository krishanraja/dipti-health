# API contract

## App API (Vercel, same origin, cookie auth)

- `POST /api/login {code, persona?}`
  - Checks `DIPTI_CODE` (opens as `dipti`) or `ACCESS_CODE` (opens as `family`). Both are case-insensitive.
  - Sets `dipti_session` (HttpOnly, Secure, 1 year).
  - Returns `{role, askWho, people}`.
  - `POST /api/login {persona: 'dipti'|'family'}` switches a logged-in device. `DELETE /api/login` logs out.
- `GET /api/session` returns `{authed, role, sheetConfigured, ai, people}`, or 401 when not logged in.
- `GET /api/canon` returns the whole Sheet in the shape below. Chat notes come without their stored DATA.
- `POST /api/write {action, payload, by}` proxies one Sheet write. A Dipti session is always written as "Dipti".
- `POST /api/ask {message, thread[{role, text}], threadId, rid, by, image?{data, type}}` streams NDJSON:
  - `stage`, then `delta` events with the reply text, then one `answer`, then `learned`.
  - `answer` is `{urgency, reply, doNow[], watchFor[], askTheDoctor[], evidence[{point, ref, title, url, grade}], usedFromRecord[], replies[], learned[], results[], limits}`.
- `GET /api/answer?rid=` recovers a reply the device missed.
- `POST /api/photo {image}` returns `{kind, summary, unreadable, results[{date, test, result, range, lab, notes, duplicate, dateGuessed}]}`. It saves nothing.

## Sheet API (Apps Script, server to server only)

- **URL:** Vercel env `SHEET_API_URL`.
- **Auth:** `secret`, sent as a query parameter on GET or a body field on POST. It must equal the script property `APP_SECRET`, which `setup()` creates.
- **Source of truth:** `apps-script/Code.gs` (`TABS`).

Endpoints:

- `GET ?secret=..&action=ping|read`
- `POST` (`Content-Type: text/plain`) `{secret, action, by, payload}`. Actions:
  - `checkin {answers:{tooth 0-10, abdomen 0-10, fatigue 0-10, sleep good|ok|poor, bowels normal|loose|diarrhoea|constipated, mood ok|low|very-low}, notes?}`. Returns a verdict: `Steady`, `Changed` or `Act-today`. `Act-today` means diarrhoea (steroid sick-day rules) or pain of 9 or more.
  - `note {text, tag?}`
  - `testResult {date, test, result, range?, lab?, notes?}`
  - `question {id?, question?, askWhom?, priority?, status open|asked|answered?, answer?}`
  - `gap {id?, gap?, whatAnswersIt?, stepToClose?, status open|in-progress|closed?}`
  - `priority {id?, title?, rank?, status now|waiting|better|done?, why?, plan?, nextStep?, askWhom?}`
  - `clinician {name, role?, owns?, contact?, lastSeen?, notes?}`
  - `profile {key, value}`
  - `condition {name, status?, notes?, since?, evidence?}`
  - `medication {name, generic?, dose?, timing?, rx?, purpose?, status current|stopped|check?}`

Every edit to an overwrite tab is written to `Changelog` with who made it.

## Note tags

| Tag | Format |
|---|---|
| `symptom-log` | `SYMPTOM: … \nDATA: {symptom, when, severity, note, level}` |
| `meds-taken` | `MEDS: taken` |
| `dipti-says` | Free text in her own words |
| `fact` | `FACT: …` or `FACT REMOVED: …` (the knowledge bank) |
| `concern` | A chat exchange, with `RID` and `DATA` |
| `record` | Seeded history: `REPORTED: …` or `MEDICINE CHANGE: …` |
