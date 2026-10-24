# Holistic

Dipti's personal health companion. It runs on her phone and in a fuller desktop overview. Her private Google Sheet is the record: the app reads it and writes to it, and she can open the Sheet herself at any time.

It is built on the design system, architecture and mission of Beside (`krishanraja/kimon`), adapted for Dipti's conditions and priorities.

## What it does

- **Today (phone).** Shows her top three priorities, each with one next step. It also has a 30-second check-in that scores tooth pain, tummy pain and tiredness from 0 to 10 and records sleep, bowels and mood. From here she can log a symptom, photograph a result, or tick her tablets.
- **Overview (screens 1024 px and wider).** One screen in three columns:
  - Now: priorities, check-in trends, and questions grouped by doctor.
  - Medicines: her current list side by side with the last written prescription.
  - Trends: lab results over time.

  Clicking any card opens its detail and the graded evidence behind it.
- **Record.** Priorities, medicines, results, questions, things to clear up, doctors and history. Each section links to its tab in the Sheet.
- **Conditions.** One condition at a time. "On its own" shows what it is, where it stands (long-term, being watched or settled; since when; who looks after it), the medicines and results in her record that belong to it, and the questions for that doctor. "How it connects" draws a two-column map of everything the research pack links it to, filtered by kind (medicines, results, conditions, symptoms). Tapping a dot gives one plain sentence and one question she could ask; on a phone this opens in a sheet that steps through every link. On wide screens the list, the condition and its map sit side by side.
- **Ask Ellie.** A chat with a young English GP who knows her whole record and the research pack in her Sheet. Replies are streamed. She can use voice or a photo.
- **Still right? (the fact checker).** Her medicines, symptoms and appointments change often, so the app keeps asking, gently. A few quick checks come up each day on Today (and in the overview): "Are you still taking X?", "Did you see Dr Y yesterday?", "How is your tooth pain now?". One tap answers; a change asks for the new dose or date on a second screen. Anything not confirmed in 7 days comes round again; a booked appointment that has passed comes first. Each answer is written to her Sheet and its Changelog straight away. In chat, when she mentions a change ("I stopped X", "the dentist moved me to Friday"), Ellie shows a confirm card, and nothing is written until she taps Yes.
- **Appointments.** In Record: what is coming up and what is done, with an Add button. The next one shows on Today, and summaries for a doctor list that doctor's next appointment and when the medicine list was last confirmed.
- **Add to my record.** One round + (or "+ Add" on a computer) opens everything she can add: write or talk it through (as long as she likes, typed, spoken or dictated), how she feels today, a symptom, a medicine change, a test result (photo or typed), an appointment, a question for a doctor, and tablets taken.
- **Feedback.** One tap on how it feels to use (confusing, missing, not right, too much to read, hard to tap or see, or I like this), then an optional note, typed or spoken. Each one is a row in the Sheet's Feedback tab, with the screen she came from.
- **A note for a doctor.** Pick a doctor and get a short, warm note in her own words: what it is about, the steroid if she takes one, and at most two questions. One tap copies it to paste into WhatsApp or an email.

### How it behaves

- **Nothing scrolls, on any device.** Every screen fits the window. Long lists turn pages (arrows, swipe, or the arrow keys) instead of scrolling, and each list re-packs itself when the window changes size. The one exception is the chat thread with Dr Ellie. `scripts/noscroll.mjs` checks every screen at 12 sizes, from a 320 px phone to a 1920 px desktop, in portrait and landscape.
- **One order on every screen.** What it is, then where it stands, then one action, then the detail behind a tap.
- **Calm and proportionate.** Every log and reply gives one "how much to worry" level and one next step. It never lists rare possibilities. A repeat question within a day is answered by pointing back to the plan. Lists of "possible causes" in the research pack are for the doctor's reasoning and are never shown on screen.
- **Never under-calls a real red flag.**
  - Deterministic rules run before any AI. They cover steroid sick-day signs, dental infection, liver and gut warning signs, collapse, and medicine reactions.
  - The AI can raise urgency but never lower it.
  - Emergency numbers are given for India (112, 108) and the UK (999, 111).
- **Never changes medicines.** Where her list and her prescription differ, the app asks her to confirm with the prescriber.

## Who sees what

| Code (Vercel env) | Opens as | Writes are credited to |
|---|---|---|
| `DIPTI_CODE` | Dipti | Always "Dipti" |
| `ACCESS_CODE` | Family helping out (Krish). The device asks who is using it | That person's name |

## Architecture

```
phone / laptop ──► Vercel (public/ static app + api/ functions)
                     │   /api/canon, /api/write ──► Apps Script web app ──► Dipti's Google Sheet (the record)
                     │   /api/ask, /api/photo   ──► Claude via Vercel AI Gateway (record + research pack + knowledge/)
                     │   /api/transcribe        ──► OpenAI speech-to-text (OPENAI_API_KEY)
```

- **The Sheet** holds everything personal: profile, priorities, conditions, medicines, results, check-ins, questions, gaps, doctors, notes, the change log, and the research pack (`Evidence` and `Sources` tabs). The tab schema is defined in `apps-script/Code.gs`; `data/schema.json` is generated from it.
- **`knowledge/`** holds general, non-personal evidence only. At present that is `dental-evidence.md`, with 30 graded references.

## Set it up (one time, Krish)

1. **Make the Sheet.**
   1. Upload `Dipti-canon.xlsx` to your Google Drive. It is built from her record by `scripts/build_seed.py` and is kept outside this repo.
   2. Open it with Google Sheets, then choose File › Save as Google Sheets.
2. **Add the API.**
   1. In the Sheet, open Extensions › Apps Script.
   2. Paste `apps-script/Code.gs` and save.
   3. Run `setup()` once and approve the permissions. The execution log prints the secret. `setup()` is safe to run again at any time: it adds any missing tab or column (at the end of the tab) and never touches existing rows.
   4. Choose Deploy › New deployment › Web app, with Execute as: Me and Who has access: Anyone. Copy the `/exec` URL.
3. **Create the Vercel project** from this GitHub repo. No build step is needed.
4. **Set the environment variables** in Vercel:

   | Variable | What it is |
   |---|---|
   | `SHEET_API_URL` | The Apps Script `/exec` URL |
   | `SHEET_API_SECRET` | The secret `setup()` printed |
   | `SESSION_SECRET` | At least 32 random characters |
   | `DIPTI_CODE` | Dipti's passcode |
   | `ACCESS_CODE` | The family passcode (Krish) |
   | `PEOPLE` | Optional, e.g. `[{"name":"Dipti","patient":true},{"name":"Krish"}]` |
   | `OPENAI_API_KEY` | Voice to text |
   | `ANTHROPIC_API_KEY` | Optional. Without it the app uses the Vercel AI Gateway through the deployment's OIDC token |

5. **Share the Sheet** with Dipti as an editor.

**After a Code.gs update:** paste the new `apps-script/Code.gs`, run `setup()` (it adds any new columns), then Deploy › Manage deployments › edit › Version: New version › Deploy. The `/exec` URL stays the same. The app finds columns by their header text, so columns can be moved in the Sheet without breaking anything; do not rename a header.

## Develop

```
npm install
npm test                                     # unit tests
node scripts/simulate.mjs                    # Dipti + Krish end to end against the real Code.gs (emulated)
MOCK_SHEET=1 MOCK_AI=1 node scripts/dev-server.mjs   # http://localhost:3000, codes "dipti-local" / "local"
node scripts/noscroll.mjs http://localhost:3000 [shots dir] [--quick]   # proves nothing scrolls or is cut off, at 12 sizes
node scripts/schema.mjs                      # regenerate data/schema.json after changing TABS in Code.gs
python3 -I scripts/build_seed.py <record.json> <kb dir> <out dir>   # rebuild the seed workbook (data stays outside the repo)
```

## This repo is public: never commit personal data

- Her record, the research pack, the seed workbook, PDFs and transcripts never go into git.
- Tests and fixtures use invented names and values only.
- `.gitignore` blocks the obvious file types.
- Before pushing, grep for her surname, her doctors' names, her medicine brands and her lab values.
