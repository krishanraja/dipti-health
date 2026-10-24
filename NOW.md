---
repo: krishanraja/dipti-health
product: Holistic
as_of: 2026-10-24
head: see git log
lifecycle: deployed (production branch claude/magical-mayer-ojpf7z)
production_url: https://www.xrds.au (xrds.au redirects; dipti-health.vercel.app also works)
state_doc: README.md
history_log: docs/DECISIONS.md
truth_files: [docs/NORTH_STAR.md]
authority_order: [docs/NORTH_STAR.md, README.md]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
---

# Holistic: where it is right now

## What it is

Holistic is Dipti's personal health companion. It is a phone app with a fuller desktop overview. Her private Google Sheet is the record: the app reads it and writes to it, and she can read it directly. It is built on the design system and mission of Beside (`krishanraja/kimon`).

## Who it is for

Dipti, day to day. Krish signs in to help, and his entries are credited to him.

## Where it is right now

<!-- north-star-state {"week_of":"2026-10-19","week_target":null,"current":0,"urgency":"U4","urgency_reason":"North Star is a proposal awaiting Krish; nothing is deployed, so the number cannot be measured yet"} -->
North Star: **proposed, not set** (see `docs/NORTH_STAR.md`). Current value: 0, because the app is not live. Urgency is U4: the number is not measured yet.

What is built and verified locally:

- Phone app: Today, Record, Conditions, Ask Ellie and Feedback.
- Desktop overview at 1024 px and wider.
- Apps Script data layer with 18 tabs, two of them hidden (`_Ops`, `_Chats`). Writes apply once and run under a lock (D24).
- Red-flag rules.
- Proportion rules.
- Research pack retrieval.
- Doctor summaries.
- Seed workbook built from her record.

- Conditions tab: one condition on its own, and a map of how it connects (D12, D13).
- Fact checker (D18 to D21): a few "still right?" checks a day, an Appointments tab, and Ellie proposing Sheet updates that Dipti confirms. Every confirm or correction is a row in the Changelog with By = Dipti, which is how the North Star gets measured.
- No scrolling anywhere except the chat thread (D14). `scripts/noscroll.mjs` checks every screen, list page, sheet, panel and flow at 12 sizes (320×568 to 1920×1080, portrait and landscape), with her real record loaded locally only.

Results: `npm test` 89/89, `node scripts/simulate.mjs` 30/30, and `scripts/noscroll.mjs` clean at all 12 sizes on her real record (about 1,200 screens, both logins), plus the invented fixture and an empty record.

## What changed recently

- 23 Oct 2026: first build. See `docs/DECISIONS.md` (D1–D11).
- 23 Oct 2026 (later): Conditions tab, no-scroll on every device, header-based Sheet columns (D12–D17). Deployed to Vercel; xrds.au is attached but its DNS is not working yet.
- 23 Oct 2026 (evening): fact checker and Appointments (D18–D21).
- 24 Oct 2026: design system v2, a two-column Conditions map with a detail sheet on phones, writes that apply once and never pile up, read-aloud removed, and a Feedback tab (D22–D28).

## What is next and waiting on Krish

1. Paste the new `apps-script/Code.gs`, run `setup()` (it adds the Feedback, `_Chats` and `_Ops` tabs), and publish a new version of the deployment. Until then the app works through fallbacks, but replays are not de-duplicated and Feedback cannot save.
2. Share the Sheet with Dipti as an editor, then give her `DIPTI_CODE`.
3. Done 24 Oct: xrds.au is live (Vercel DNS turned on). https://www.xrds.au serves the app and xrds.au redirects to it.
4. Optional: re-import the rebuilt `Dipti-canon.xlsx` for one label fix ("Weight gain").
5. Confirm or replace the North Star draft. The name "Holistic" (renamed from Steady on 24 Oct) and the persona "Dr Ellie" are confirmed.

## Read next

`README.md`, `HANDOVER.md`, `docs/DECISIONS.md`, `docs/API.md`.

## Do not trust

- Anything about real AI answers against the live Sheet: every automated check so far used the emulator and a scripted model.
