# Receipts demo history: ACME pricing page

A scripted, believable Claude Code history for the Receipts demo. The correct app lives in `../target`. This folder builds a demo repo whose history leads to the four planted bugs.

## Pieces
- `seed/` starting repo: the final ACME look (header, Pricing title, toggle, coupon box, Pro and Team cards) with static placeholder numbers and dead buttons. No pricing logic. It builds as is.
- `sessions/01-base.md` 8 prompts. Per-card seats, monthly prices, Team minimum 3, SAVE10. Correct behavior, no bugs. This Trail merges first and becomes the regression suite.
- `sessions/02-annual-volume.md` 10 prompts. Annual billing, Team volume discount, coupon with annual, plus later refactors. It ends with the four bugs. This is the demo Trail.
- `sessions/03-fix.md` 6 prompts. The developer pastes the Receipts bug report and Claude fixes all four. The result behaves like the control build.
- `ANSWER_KEY.md` which prompt introduces which bug and which earlier prompt stated the violated requirement.
- `run-sessions.sh` replays the prompts through headless `claude -p` into an empty repo, building and committing after each session. Run `--dry-run` first. `PAUSE_BETWEEN=1` waits between sessions so the Trail can be merged.
- `verify/` Playwright check (`check.mjs`) with PASS or FAIL per check for the buggy and correct builds.
- `reference/` the hand-built final code after session 2 (buggy) and session 3 (fixed), a fallback if a live replay drifts.

## How it fits
seed -> session 1 (merge, regression suite) -> session 2 (push, Receipts finds A to D and points at 02/05, 02/06, 02/07, 02/08) -> session 3 (fix, re-run green).

## Honest note
The sessions are scripted by us. The prompts are written, not organically typed, and they are replayed into real Claude Code sessions. The final code is behaviorally identical to the current buggy `target` build (same UI and the same four bug behaviors, checked pixel for pixel on the default and annual views against the control build and by `verify/check.mjs`), but not byte identical, because the demo repo has no bug flags. The write-up and the pitch must say the history is scripted.
