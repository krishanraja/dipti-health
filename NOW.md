---
repo: krishanraja/dipti-health
product: Steady
as_of: 2026-10-23
head: see git log
lifecycle: built, not deployed
production_url: none
state_doc: README.md
history_log: docs/DECISIONS.md
truth_files: [docs/NORTH_STAR.md]
authority_order: [docs/NORTH_STAR.md, README.md]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
---

# Steady: where it is right now

## What it is

Steady is Dipti's personal health companion. It is a phone app with a fuller desktop overview. Her private Google Sheet is the record: the app reads it and writes to it, and she can read it directly. It is built on the design system and mission of Beside (`krishanraja/kimon`).

## Who it is for

Dipti, day to day. Krish signs in to help, and his entries are credited to him.

## Where it is right now

<!-- north-star-state {"week_of":"2026-10-19","week_target":null,"current":0,"urgency":"U4","urgency_reason":"North Star is a proposal awaiting Krish; nothing is deployed, so the number cannot be measured yet"} -->
North Star: **proposed, not set** (see `docs/NORTH_STAR.md`). Current value: 0, because the app is not live. Urgency is U4: the number is not measured yet.

What is built and verified locally:

- Phone app: Today, Record and Ask Dr Ellie.
- Desktop overview at 1024 px and wider.
- Apps Script data layer with 14 tabs.
- Red-flag rules.
- Proportion rules.
- Research pack retrieval.
- Doctor summaries.
- Seed workbook built from her record.

Results: `npm test` 62/62 and `node scripts/simulate.mjs` 27/27. Screens were checked at 390 px and 1440 px, in light and dark mode, with her real record loaded locally only.

## What changed recently

- 23 Oct 2026: first build. See `docs/DECISIONS.md` (D1–D10).

## What is next and waiting on Krish

1. Import `Dipti-canon.xlsx` into Google Sheets (Krish's account).
2. Paste `apps-script/Code.gs` into the Sheet's Apps Script, run `setup()` and deploy it as a web app.
3. Create the Vercel project from this repo and set the environment variables listed in `README.md`, including `OPENAI_API_KEY`.
4. Share the Sheet with Dipti as an editor, then give her `DIPTI_CODE`.
5. Confirm or replace: the North Star draft, the name "Steady" and the persona "Dr Ellie".

## Read next

`README.md`, `HANDOVER.md`, `docs/DECISIONS.md`, `docs/API.md`.

## Do not trust

- Anything about real AI answers or the live Sheet. Neither has been run yet: every check so far used the emulator and a scripted model.
