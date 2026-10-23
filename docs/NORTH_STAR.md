# North Star

Status: Proposed (draft by Claude, 23 October 2026). Not set until Krish confirms or replaces it.
Owner: Krish Raja

> Draft for Krish: Dipti knows where each of her health priorities stands and what to do next, from her own record, without having to chase a doctor or search late at night.
>
> Draft: by 31 January 2027, Dipti uses Steady herself every week, and her tooth, tummy pain and tiredness each have a plan her doctors have confirmed.

## The number (draft)

**Times a week Dipti adds something to Steady herself** (check-ins, logs, notes, chats): 3 by 25 January 2027, on a linear weekly ladder.

```yaml north-star-metric
metric: "Times a week Dipti adds something to Steady herself"
unit: count
direction: up
target: 3
deadline: 2027-01-25
ladder_shape: linear
source: "Rows in her Sheet credited to Dipti by the server (By = Dipti)"
status: proposed
ladder:
  - [2026-11-02, 1]
  - [2026-11-16, 1]
  - [2026-11-30, 2]
  - [2026-12-14, 2]
  - [2026-12-28, 2]
  - [2027-01-11, 3]
  - [2027-01-25, 3]
```

Urgency (U1 to U5) is worked out every week from where the number stands against that week's target, by [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md).

## How to use it

- Read it before any work, every session.
- Before you start, say which part of it the task moves. If the task moves nothing towards it, say so first and let Krish decide.
- Prefer the work that moves it furthest, and close each session by noting what moved.
- Only Krish changes this file. Record his ruling in the commit body as `Ruling (Krish, YYYY-MM-DD): ...`.
