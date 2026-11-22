# Handoff

Read `SPEC.md` (status, decisions) and `README.md` (how to run). One agent builds everything now.

## Facts
- Demo repo: `marcocharco/acme-pricing-demo`, local clone `/Users/marco/Developer/acme-pricing-demo`. Trail #3 is merged (base pricing), Trail #4 is open (annual billing and volume pricing, branch `feat/annual-volume`).
- Buggy site (`TARGET_URL`): https://acme-pricing-demo.vercel.app. Fixed site (`TARGET_CONTROL_URL`): https://acme-pricing-demo-fixed.vercel.app (branch `feat/annual-volume-fixed`). Verify with `demo/verify/check.mjs <url> --expect buggy|correct`.
- `.env.local`: `ENTIRE_PROJECT=gh/marcocharco`, `TARGET_REPO_DIR` (the clone above), `TARGET_URL`, `TARGET_CONTROL_URL`, `CONCURRENCY=2` (TinyFish default, not raised). Database name is `receipts` (not renamed).
- The finding marker is `[archerfish:<requirement id>]`. Findings filed earlier under `[receipts:...]` are not matched.
- Answer key for the planted bugs: `demo/ANSWER_KEY.md` (A and D in `annualQuote`, B in the strict `>`, C in `PricingCard` decrease; prompts 02/05, 02/08, 02/07, 02/09).

## Gotchas
- TinyFish strict mode needs the beta; default concurrency is 2. The agent sometimes returns an empty result list (rerun automatically) and sometimes quotes the expectation instead of the page (the screenshot check catches it).
- An exported `TINYFISH_API_KEY` or `GEMINI_API_KEY` in the shell beats `.env.local`.
- Replay files live in `data/replays/` (gitignored); the video link expires after 15 minutes, so replays are downloaded right after each session.
- Never put the personal email in requests or files. Eight early checkpoints on `qa-agent` contain it (accepted). Scan any new checkpoint before pushing it.
- `entire brain setup` in the demo repo edits its `AGENTS.md` and has not been run.
