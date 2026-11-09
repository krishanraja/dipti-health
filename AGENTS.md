# AGENTS.md

<!-- north-star:start -->
## North Star: read it first, every session

This repository's North Star is [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md): an ambition Krish set that is not reached yet.

- Read it before any work, every session.
- Before you start, say which part of it the task moves. If it moves nothing, say so first and let Krish decide.
- Prefer the work that moves it furthest, and close by noting what moved.
- Check the North Star number and its urgency (U1 to U5) on the first line under "Where it is right now" in `NOW.md`, and push at the intensity [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md) sets for that level. Update it whenever you can measure it; a number nobody measures is U4.
- Only Krish changes it.
<!-- north-star:end -->

## Branches and merging (Krish, 9 Nov 2026)

`main` is the default branch and deploys to production (www.xrds.au) on every push.

- Work on one branch per change. Show Krish the result before anything reaches `main`; pushing to `main` publishes.
- When Krish says merge, open a pull request into `main` and merge it yourself. The repo deletes the branch on merge, so never leave branches for Krish to clean up and never ask him to.
- Never leave more than `main` on GitHub at the end of a session. If a branch cannot be removed, bring its last change in through a pull request so the merge removes it.
