---
repo: krishanraja/dipti-health
product: Steady
as_of: 2026-10-23
head: see git log
lifecycle: deployed (production branch claude/magical-mayer-ojpf7z)
production_url: https://xrds.au (DNS pending; dipti-health.vercel.app works)
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

- Phone app: Today, Record, Conditions and Ask Dr Ellie.
- Desktop overview at 1024 px and wider.
- Apps Script data layer with 14 tabs.
- Red-flag rules.
- Proportion rules.
- Research pack retrieval.
- Doctor summaries.
- Seed workbook built from her record.

- Conditions tab: one condition on its own, and a map of how it connects (D12, D13).
- Fact checker (D18 to D21): a few "still right?" checks a day, an Appointments tab, and Ellie proposing Sheet updates that Dipti confirms. Every confirm or correction is a row in the Changelog with By = Dipti, which is how the North Star gets measured.
- No scrolling anywhere except the chat thread (D14). `scripts/noscroll.mjs` checks every screen, list page, sheet, panel and flow at 12 sizes (320×568 to 1920×1080, portrait and landscape), with her real record loaded locally only.

Results: `npm test` 83/83, `node scripts/simulate.mjs` 28/28, and `scripts/noscroll.mjs` clean at all 12 sizes on her real record (about 1,200 screens, both logins), plus the invented fixture and an empty record.

## What changed recently

- 23 Oct 2026: first build. See `docs/DECISIONS.md` (D1–D11).
- 23 Oct 2026 (later): Conditions tab, no-scroll on every device, header-based Sheet columns (D12–D17). Deployed to Vercel; xrds.au is attached but its DNS is not working yet.
- 23 Oct 2026 (evening): fact checker and Appointments (D18–D21).

## What is next and waiting on Krish

1. Re-import the rebuilt `Dipti-canon.xlsx` (it adds the Conditions and research-pack plain-language columns), paste the new `apps-script/Code.gs`, run `setup()`, and publish a new version of the deployment.
2. Share the Sheet with Dipti as an editor, then give her `DIPTI_CODE`.
3. Fix the xrds.au DNS. The .au registry delegates the domain to name servers that refuse to answer for it (a lame delegation), so the site cannot load there yet. At the registrar, set the name servers to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. Until then the app is live at the Vercel URL.
5. Confirm or replace the North Star draft. The name "Steady" and the persona "Dr Ellie" are confirmed.

## Read next

`README.md`, `HANDOVER.md`, `docs/DECISIONS.md`, `docs/API.md`.

## Do not trust

- Anything about real AI answers against the live Sheet: every automated check so far used the emulator and a scripted model.
