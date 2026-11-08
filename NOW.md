---
repo: krishanraja/dipti-health
product: Holistic
as_of: 2026-10-24
head: see git log
lifecycle: deployed (default branch main since 8 Nov; Vercel still deploys production from claude/magical-mayer-ojpf7z until its production branch is switched to main)
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

<!-- north-star-state {"week_of":"2026-11-02","week_target":1,"current":1,"urgency":"U3","urgency_reason":"Read from her Sheet on 8 Nov: one day with entries by Dipti this week (3 Nov, 16 rows), on the week's target of 1, but nothing since 3 Nov and only two check-ins ever; urgency is Claude's reading, not yet checked against the harness contract"} -->
North Star: **proposed, not set** (see `docs/NORTH_STAR.md`). Measured from her Sheet on 8 Nov, counting days with an entry by Dipti: week of 26 Oct, 2 days (24 rows); week of 2 Nov, 1 day so far (3 Nov, 16 rows), which meets this week's target of 1. Nothing since 3 Nov, and only two check-ins in total. Urgency U3 (Claude's reading).

What is built and verified locally:

- Phone app: Today, My record, My care, Ask Ellie and Feedback, plus the + console.
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

Results (8 Nov, invented fixture): `npm test` 111/111 (also under TZ=Asia/Kolkata), `node scripts/simulate.mjs` 30/30, `scripts/noscroll.mjs` (see HANDOVER). Earlier (24 Oct): and `scripts/noscroll.mjs` clean at all 12 sizes on her real record (about 1,200 screens, both logins), plus the invented fixture and an empty record.

## What changed recently

- 8 Nov 2026: daily check-in reminder by email, off until armed (D54).
- 8 Nov 2026: input audit against her real Sheet. Dates and times come back as typed; "Still right?" no longer loses answers to a second tap; she can record stopping a medicine that is not on her list; a check-in note that names a medicine offers to update it; Ellie no longer re-adds questions she already has; after each check-in she sees how today compares with her own recent days, and Today and My care carry her trends (D46–D53).

- 23 Oct 2026: first build. See `docs/DECISIONS.md` (D1–D11).
- 23 Oct 2026 (later): Conditions tab, no-scroll on every device, header-based Sheet columns (D12–D17). Deployed to Vercel; xrds.au is attached but its DNS is not working yet.
- 23 Oct 2026 (evening): fact checker and Appointments (D18–D21).
- 24 Oct 2026 (night): calm by default. My care replaces Conditions, Today shows one step, words instead of counts, warm visual language (D38–D43).
- 24 Oct 2026 (evening): one input console with long notes, notes to doctors in her voice, button system v3, Feedback that starts fresh, and a Sheet version check (D32–D37).
- 24 Oct 2026: design system v2, a two-column Conditions map with a detail sheet on phones, writes that apply once and never pile up, read-aloud removed, and a Feedback tab (D22–D28).

## What is next and waiting on Krish

0. Done 8 Nov: merged to production and to `main` (now the default branch); Code.gs 2026-11-08b pasted, `setup()` run, new version published, reminder set up as krishanraja@gmail.com (the Sheet's owner). Still open: switch Vercel's production branch to `main`. Earlier steps, kept for reference: paste the new `apps-script/Code.gs` (version 2026-11-08b), run `setup()`, and publish a new version of the deployment. Settings will say the Sheet is out of date until then. The app repairs dates on the server, but times are exact only with the new script.
0a. Turn on the daily check-in reminder (D54): Project Settings › Script properties › add `REMINDER_TO` = Dipti's email (optionally `REMINDER_HOUR`, default 19, India time), then run `setupReminder()` once and allow the permissions. `stopReminder()` turns it off.
0b. On her Medications tab, five rows she confirmed on 26 Oct have no CheckedAt (lost to the double-tap bug, D50), so she will be asked about them again; that is expected and harmless. Her latest check-in note mentions a dose change that is not on her list yet.

1. Paste the new `apps-script/Code.gs`, run `setup()` (it adds the `_Journal` tab, and Feedback, `_Chats` and `_Ops` if missing), and publish a new version of the deployment. Until then the app works through fallbacks, but replays are not de-duplicated and Feedback cannot save.
2. Share the Sheet with Dipti as an editor, then give her `DIPTI_CODE`.
3. Done 24 Oct: xrds.au is live (Vercel DNS turned on). https://www.xrds.au serves the app and xrds.au redirects to it.
4. Optional: re-import the rebuilt `Dipti-canon.xlsx` for one label fix ("Weight gain").
5. Confirm or replace the North Star draft. The name "Holistic" (renamed from Steady on 24 Oct) and the persona "Dr Ellie" are confirmed.

## Read next

`README.md`, `HANDOVER.md`, `docs/DECISIONS.md`, `docs/API.md`.

## Do not trust

- Anything about real AI answers against the live Sheet: every automated check so far used the emulator and a scripted model.
