# Handoff: dashboard session

You are continuing the **ArcherFish dashboard**, a local web app where the user reviews and edits requirements, watches live tests, and reads bug reports. Read `SPEC.md` (Status, "Features", "Demo script") and this file. Work only in this worktree.

## Three sessions, three owners
- **Product session** (Rex tab `product-session`): `/Users/marco/Developer/hw13`, branch `main`. The engine: orchestrator, Entire integrations, findings, eval. Its notes are in `HANDOFF.md`.
- **Dashboard session (you):** `/Users/marco/Developer/hw13-ui`, branch `dashboard`, localhost port **3100**.
- **Demo session:** `/Users/marco/Developer/hw13-demo` and the separate repo `/Users/marco/Developer/acme-pricing-demo`. It builds the site and chat history that ArcherFish tests. Notes in `demo/HANDOFF-DEMO.md` on branch `demo-kit`.
- You own `app/**`, `components/**`, and the dashboard's own libs: `lib/queries.ts`, `lib/process.ts`, `lib/report.ts`, `lib/brain.ts`. Do **not** edit `lib/orchestrator.ts`, `lib/entire.ts`, `lib/compile.ts`, `lib/extract.ts`, `lib/findings.ts`, `lib/verdict.ts`, `lib/tinyfish.ts`, `lib/gemini.ts` or `db/schema.sql`. Import from them. If you truly need a change there, stop and tell the user exactly what.
- Do not push, do not touch `main`, do not edit the other worktrees. Never print `.env.local` values (it is a symlink to the product tree's file). Never call Gemini live (limited credits). Never use the em dash.

## State (all committed on `dashboard`, tree clean, 27 tests passing)
Four commits: requirements workspace and seed script, live run grid, bug report with zoom levels and overrides plus Trail history, Brain write-back.

**Screens and routes**
- `/` Trail list. `/t/[trailId]` requirements workspace: New and Regression split, status, type, confidence, testable, receipt chip (source message in context), approve, reject, inline edit, add manual requirement, untestable rows greyed with the reason, "Run now".
- `/t/[trailId]/run` live run grid, one tile per check, embeds `checks.streaming_url` while running, badges running, passed, failed, errored, overall progress. It polls `/api/trails/[id]/live`.
- `/t/[trailId]/checks/[checkId]` bug report, level 1 summary and level 2 repro, copy as Markdown, "Copy for Claude Code", reviewer overrides. Levels 3 to 5 are stubs shown only if data exists.
- `/t/[trailId]/history` plain table of runs per commit.
- API: `POST /api/trails/[id]/run` (spawns `scripts/orchestrate.mts <trail>` through `lib/process.ts`), `POST /api/checks/[id]/override` (calls `overrideFinding`, resolves the Entire finding, sets the requirement to rejected and retracts its Brain memory when the override is "requirement is wrong"), `GET /api/requirements/[id]/receipt`.
- Approve, reject, edit and add are server actions in `app/actions.ts`.

**How it works**
- Reads local Postgres on every request, no caching (`next.config.ts` keeps Cache Components off, and has a turbopack rule for `@tailwindcss/turbopack`). Localhost only by design: it needs the local database, the Entire login in the keychain, and spawns the orchestrator locally.
- Needs these env vars in `.env.local`: `DATABASE_URL`, `ENTIRE_PROJECT`, `TARGET_REPO_DIR`, `TARGET_URL`. `lib/process.ts` `missingEnv()` reports what is missing. Check that `ENTIRE_PROJECT` is `gh/marcocharco` and `TARGET_REPO_DIR` is `/Users/marco/Developer/acme-pricing-demo` for the demo, without printing other values.
- **Brain** (`lib/brain.ts`): approving writes the requirement as a Brain memory in the target repo (`entire brain remember ... --path project.requirements.convention --kind convention`), the memory id goes in `requirements.brain_path`, and reject, edit or the "requirement is wrong" override retracts it. Brain only accepts paths under architecture, constraints, preferences, project or workflow. The `brain` (v0.5.1) and `graph` (v0.6.0) plugins are installed.
- Report text comes from `lib/report.ts` (`reportMarkdown`, `claudeCodeSummary`, `receiptWindow`, tested in `lib/report.test.ts`).

**Run and check**
- `cd /Users/marco/Developer/hw13-ui && npx next dev -p 3100`. The first request redirects (307), that is normal.
- Sample data: `npx tsx --env-file=.env.local scripts/seed-ui.mts` inserts rows whose ids start with `sample-`. `--remove` deletes them and also rows you added to a sample Trail. Remove them before judging real runs.
- Screenshots: `npx tsx scripts/shot.mts <path> <out.png> [width] [--full]`, uses system Chrome. Look at them, and check a narrow window.
- `npm run typecheck`, `npx eslint .`, `npm test`.

## Not done yet, in priority order
1. **Never seen with a real run.** Everything was built from seed data. Once the orchestrator has run on a real Trail (the demo Trail #4 will exist soon), check the live grid with a real TinyFish stream (iframe embedding, URL expiry), the Run now button end to end, and the empty and error states. TinyFish runs cost credits, so ask the user first.
2. **Replay page.** Needs step screenshots and the video from the TinyFish runs API. The schema has `steps.screenshot_path` and `checks.video_path`, but the orchestrator does not store them yet. That is product-side work. Ask the user to relay it, then build a filmstrip with the failing frame highlighted.
3. **Levels 3 to 5 of the bug report** (likely file and line, the commit and checkpoint, the exact prompt) once `entire why` attribution exists on the product side. The demo answer key (`demo/ANSWER_KEY.md` on `demo-kit`) says which prompt should be blamed for each bug.
4. **Trail history chart**, polish, empty states, narrow screens.

## Cautions
- **Brain data in the demo repo.** The previous session wrote one throwaway memory into the target repo's Brain to learn the syntax and retracted it. Retracted memories stay stored until Brain prunes them. Before the demo repo or its Brain data is pushed anywhere, check `entire brain memories` in `/Users/marco/Developer/acme-pricing-demo` and prune. Only approved base requirements should end up there, since the "prevention" demo beat relies on it.
- **Merge conflicts with the product session.** The likely collision points are `package.json`, `package-lock.json` and `next.config.ts`. Everything else is new files. Merging `dashboard` into `main` is for the user or the product session to do at a clean boundary.
- A previous command in this session tried `git checkout -- .`, which would have wiped uncommitted work. The permission check blocked it. Commit before any risky git command.
- Keep the look consistent: light theme, white background, near black text, dark pill buttons, hairline borders, one orange accent (#d9480f), Geist font, simple and minimal.

## Decisions pending for the user
- Whether to run the dashboard against a real Trail with live TinyFish runs (costs credits) once Trail #4 exists.
- When to merge `dashboard` into `main`.
