# 2026-11-08: input audit

Status: merged to production (`claude/magical-mayer-ojpf7z`) on 8 Nov with the daily reminder (D54). Tests 111/111 (UTC and India time), simulation 30/30; no-scroll checked on the invented fixture.

What moved: audited against her real Sheet (read-only). Fixed answers lost to a second tap in "Still right?", duplicate saves, no way to record stopping a medicine that is not on her list (her own feedback), dose changes left in check-in notes, Ellie re-adding questions, and dates and times read back from the Sheet. Every check-in now gives her a personal read, and Today and My care carry her trends.

Next step: Krish pastes Code.gs 2026-11-08b, runs `setup()`, publishes a new deployment version, sets REMINDER_TO and runs `setupReminder()`.

North Star check: measured from her Sheet. Week of 2 Nov: 1 day with entries by Dipti (3 Nov), on target (1). Nothing since 3 Nov; two check-ins ever. U3 (Claude's reading).
