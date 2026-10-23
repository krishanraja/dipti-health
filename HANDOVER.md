# HANDOVER: for the next AI taking over

## 2026-10-23 (evening): fact checker

- [x] `public/js/facts-model.js` (what is due, in what order, and the writes for each answer). Tests: `test/facts-model.test.js`.
- [x] Code.gs: Appointments tab, `CheckedAt` columns, `appointment` and `check` actions. Tests: `test/sheet.test.js`.
- [x] Today and overview cards, the check flow (`factFlow` in `public/js/today.js`), and the Appointments list and Add form in Record.
- [x] Ellie's proposals: `updates[]` in the chat answer, filtered by `lib/updates.js` (tests: `test/updates.test.js`), shown as confirm cards in `public/js/chat.js`. The simulation covers chat, then confirm, then the Sheet, then not asked again.
- [ ] Real-model behaviour for `updates` is unverified: the scripted model was used. Watch the first week's Changelog.
- [ ] xrds.au DNS (see `NOW.md`).

## 2026-10-23 (later): Conditions tab and no-scroll

### Done and verified (locally)

- [x] Conditions tab (`public/js/conditions.js`, `conditions-model.js`, tests in `test/conditions-model.test.js`). Links come only from interaction rows in the Evidence tab; labels and plain text come from the new `Plain`/`AskPlain`/`AlsoCalled` columns.
- [x] Pager (`public/js/pager.js`) used by Record lists, Conditions, the overview, panels and sheets. `autoPages()` turns any `[data-pages]` block into pages; wire clicks by delegation.
- [x] Code.gs finds columns by header; `setup()` adds missing ones (`test/sheet.test.js`).
- [x] `scripts/noscroll.mjs`: 12 sizes, both logins, real seed. Run it after any screen change.

### Not verified (needs Krish)

- [ ] The live Sheet has the new columns and plain text (re-import + `setup()` + new deployment version).

### Next

- Fact checker (Krish's decisions: a few checks a day; new Appointments tab; Ellie proposes, Dipti confirms; build without a mock).


## 2026-10-23: first build

### Done and verified (locally)

- [x] Krish confirmed the name "Steady" and the persona "Dr Ellie". New friendly icon and favicon (D11).

- [x] Scaffolded from `krishanraja/kimon` (Beside). Kimon-only parts were removed: `me.html`, the Dad tab, and the cardiology corpus.
- [x] Auth.
  - `DIPTI_CODE` opens as `dipti` and `ACCESS_CODE` opens as `family`.
  - Dipti's writes are always credited to "Dipti".
  - Tests: `test/auth.test.js`.
- [x] Apps Script (`apps-script/Code.gs`).
  - The `TABS` list is the single schema. `setup()` creates tabs and the secret, and the secret lives in Script Properties.
  - Time zone is Asia/Kolkata.
  - New tabs: Priorities, Clinicians, Evidence and Sources. New actions: `priority` and `clinician`.
  - New check-in: tooth, abdomen and fatigue (0–10), plus sleep, bowels and mood.
- [x] Triage (`public/js/triage.js`).
  - Covers steroid sick-day signs, dental infection, liver and gut, collapse and medicine reactions.
  - Negations such as "no fever" are not counted as hits.
  - Calm by default.
  - Tests: `test/triage.test.js`.
- [x] Doctor persona and prompt (`api/ask.js`).
  - Proportion rules, the repeat-question note (`repeatAsk`), the research pack from the Sheet, and both medicine lists.
  - Speaker context is either Dipti ("you") or family ("Dipti").
- [x] General dental evidence (`knowledge/dental-evidence.md`).
  - 30 references, checked by fetching each one.
  - Written generically: no patient specifics, because the repo is public.
- [x] Screens.
  - `public/js/today.js` for the phone.
  - `public/js/dashboard.js` for the desktop at 1024 px and wider.
  - `public/js/record.js`.
  - `public/js/chat.js` with `avatar.js` (Dr Ellie).
  - `public/js/brief.js` for per-doctor summaries.
- [x] Seed: `scripts/build_seed.py` turns her record JSON plus the research pack into `Dipti-canon.xlsx`.
  - Inputs and output are kept in the session scratchpad, not the repo.
  - Row counts were checked against the sources: 23 conditions, 14 current and 14 stopped medicines, 64 results, 92 evidence rows, 70 sources, 19 questions and 12 gaps.
- [x] Tests: `npm test` 62/62. `node scripts/simulate.mjs` 27/27, which runs Dipti and Krish end to end through the real Code.gs in the emulator.
- [x] PII gate: a grep of the tree finds no surname, clinician names, medicine brands or real lab values.

### Not verified (needs Krish)

- [ ] Live Sheet, Apps Script deploy, Vercel deploy and real Claude answers. See the steps in `README.md`.
- [ ] Real voice transcription, which needs `OPENAI_API_KEY`.

### Disputed or open

- Two conflicts in her dental records (scan date versus upload date, and whether a root canal was done) are recorded as gaps G11 and G12 in her Sheet, not here.

### Secrets map (where they live, never their values)

| Secret | Where it lives |
|---|---|
| Sheet secret | Apps Script Script Properties `APP_SECRET`, and Vercel `SHEET_API_SECRET` |
| Session signing key | Vercel `SESSION_SECRET` |
| Passcodes | Vercel `DIPTI_CODE` and `ACCESS_CODE` |
| Voice | Vercel `OPENAI_API_KEY` |
| AI | Vercel AI Gateway through OIDC (no key), or optionally `ANTHROPIC_API_KEY` |

### Next steps

1. Krish deploys (see `NOW.md`).
2. After the first week of real use, measure the North Star: rows in the Sheet with By = Dipti.
3. If the real AI drifts from the proportion rules, add cases to `test/speaker.test.js` and tighten `systemPrompt()`.
