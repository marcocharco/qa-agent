# Handoff: product session

Read `SPEC.md` first (decisions, priority order, prize alignment). This file is the current state of the build.

## Two sessions, two owners
- **Product session (you):** everything in this repo except `demo/`. ArcherFish itself: orchestrator, dashboard, reports, Entire integrations, eval.
- **Demo session:** `demo/` in this repo and the separate repo `marcocharco/acme-pricing-demo` (local clone at `/Users/marco/Developer/acme-pricing-demo`). It scripts the demo chat history and builds the Trails ArcherFish will test.
- `target/` is a shared fixture (ACME pricing page with bug flags, used for the eval and for development). Change it only if the product needs it.
- Use a git worktree or a branch if both sessions might commit to this repo at the same time.

## What exists and is tested
- `lib/compile.ts`: requirement to strict QA goal (Gemini behind `StructuredModel`). `lib/extract.ts`: chat to requirements with verified citations. `lib/findings.ts`: finding create, auto-resolve, reviewer override. `lib/verdict.ts`: the agent's own verdict decides, errored runs never pass. 21 unit tests, model faked at the boundary.
- Adapters, verified live but not unit tested: `lib/gemini.ts` (model fallback, backoff, quota errors fall through), `lib/tinyfish.ts` (`agent.stream`, returns `streamingUrl`, step purposes), `lib/entire.ts` (findings via the CLI, requirement id carried in the finding body as `[archerfish:<id>]`).
- `scripts/run-slice.mts`: first live loop (compile, parallel TinyFish runs, findings on the current Trail). Worked end to end.
- `db/schema.sql` and `npm run db:migrate`: schema on local Postgres (database `receipts`). Not wired to anything yet.
- `app/` is still the create-next-app placeholder. No dashboard yet.

## Run it
- `.env.local` has TinyFish, Gemini, `DATABASE_URL`, `TARGET_URL` (buggy) and `TARGET_CONTROL_URL`. Never commit it, never paste keys or the personal email in chat.
- `npm test`, `npm run typecheck`, `npx eslint .`. Scripts: `npx tsx --env-file=.env.local scripts/<file>.mts`.
- Target sites: `TARGET_URL=https://acme-pricing-demo.vercel.app` is the demo repo's buggy branch (Trail #4, public, verified with `demo/verify/check.mjs --expect buggy`). Also set `ENTIRE_PROJECT=gh/marcocharco`, `TARGET_REPO_DIR=/Users/marco/Developer/acme-pricing-demo`, and run `scripts/orchestrate.mts 4`. `TARGET_CONTROL_URL=https://acme-pricing-demo-fixed.vercel.app` is the fixed build (branch `feat/annual-volume-fixed`, verified `--expect correct`) for the green re-run. The old `receipts-demo-*` sites from `target/` are retired for the demo.

## Gotchas learned the hard way
- TinyFish: always read `result.passed`, never the run status. Sync `agent.run` has no `streaming_url`; use `agent.stream`. Default concurrency is 2 runs, ask for more. Compiler steps must be intent-level ("set seats to 5"), not control-level.
- Gemini: the key was on the free tier (20 requests a day per model), which blocks live calls. Check before relying on it. Keep live calls minimal.
- Entire: findings have no title field. A high finding fails the Agent Review gate (threshold medium). Approvals gate is off. `entire trail sessions --json` lists a Trail's sessions.
- Privacy: this repo uploads no checkpoints automatically (`manual` policy) and has email redaction on. Eight earlier checkpoints on GitHub contain a personal email; the user decided to leave them. Scan checkpoints before any `entire checkpoint push`.
- ESM: root package is `"type": "module"` because the TinyFish SDK is ESM-only.

## Next, in priority order (from SPEC.md)
1. Orchestrator for a whole Trail: watch, extract from the Trail and its sessions, compile, run in parallel with a queue, persist to Postgres, file findings.
2. Bug report levels 1 and 2 with Markdown export, reviewer override, Brain write-back on approve.
3. Dashboard: requirements workspace, live grid (`streamingUrl`), replay page (needs step screenshots from the TinyFish runs API).
4. `entire why` and prompt attribution, Graph token-savings measurement, Trail merge-recommendation comment.
5. Eval: TinyFish vs a Claude browser agent on the buggy and control builds.
