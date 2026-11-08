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

<!-- north-star-state {"week_of":"2026-11-02","week_target":1,"current":null,"urgency":"U4","urgency_reason":"North Star is still a proposal; the app is live but her Sheet was not readable from the 8 Nov build session, so this week's count is not measured"} -->
North Star: **proposed, not set** (see `docs/NORTH_STAR.md`). The app is live at www.xrds.au and in use, but this week's count (rows with By = Dipti) was not measured: her Sheet was not readable from the 8 Nov session. Urgency is U4 until someone counts it.

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

Results (8 Nov, invented fixture only): `npm test` 109/109, `node scripts/simulate.mjs` 30/30, and `scripts/noscroll.mjs` with no new failures (see HANDOVER for the pre-existing 568×320 one). Earlier (24 Oct): and `scripts/noscroll.mjs` clean at all 12 sizes on her real record (about 1,200 screens, both logins), plus the invented fixture and an empty record.

## What changed recently

- 8 Nov 2026: input audit. Dates and times now come back from the Sheet as typed; new medicines are not asked about straight away; after each check-in she sees how today compares with her own recent days; Today and My care carry her check-in trends; check-in notes reach her history and Ellie (D46–D49).

- 23 Oct 2026: first build. See `docs/DECISIONS.md` (D1–D11).
- 23 Oct 2026 (later): Conditions tab, no-scroll on every device, header-based Sheet columns (D12–D17). Deployed to Vercel; xrds.au is attached but its DNS is not working yet.
- 23 Oct 2026 (evening): fact checker and Appointments (D18–D21).
- 24 Oct 2026 (night): calm by default. My care replaces Conditions, Today shows one step, words instead of counts, warm visual language (D38–D43).
- 24 Oct 2026 (evening): one input console with long notes, notes to doctors in her voice, button system v3, Feedback that starts fresh, and a Sheet version check (D32–D37).
- 24 Oct 2026: design system v2, a two-column Conditions map with a detail sheet on phones, writes that apply once and never pile up, read-aloud removed, and a Feedback tab (D22–D28).

## What is next and waiting on Krish

0. Paste the new `apps-script/Code.gs` (version 2026-11-08), run `setup()`, and publish a new version of the deployment. Settings will say the Sheet is out of date until then. The app already repairs dates on the server, but times are exact only with the new script.

1. Paste the new `apps-script/Code.gs`, run `setup()` (it adds the `_Journal` tab, and Feedback, `_Chats` and `_Ops` if missing), and publish a new version of the deployment. Until then the app works through fallbacks, but replays are not de-duplicated and Feedback cannot save.
2. Share the Sheet with Dipti as an editor, then give her `DIPTI_CODE`.
3. Done 24 Oct: xrds.au is live (Vercel DNS turned on). https://www.xrds.au serves the app and xrds.au redirects to it.
4. Optional: re-import the rebuilt `Dipti-canon.xlsx` for one label fix ("Weight gain").
5. Confirm or replace the North Star draft. The name "Holistic" (renamed from Steady on 24 Oct) and the persona "Dr Ellie" are confirmed.

## Read next

`README.md`, `HANDOVER.md`, `docs/DECISIONS.md`, `docs/API.md`.

## Do not trust

- Anything about real AI answers against the live Sheet: every automated check so far used the emulator and a scripted model.
