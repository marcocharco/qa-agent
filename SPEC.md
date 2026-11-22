# ArcherFish — Product Spec

Nov 21, 2026 · @Marco Chen

## Summary

**Your agent chats are your test suite.** ArcherFish reads what a team told its coding agents (Entire Trails and session transcripts), turns it into plain-English requirements, tests them on the live app with parallel TinyFish browser agents, and returns bug reports with visual replays and the exact prompt that introduced each bug.

**Problem.** Teams building with coding agents state requirements in chat ("cart should survive a refresh") and never write them down. That intent is lost when the session ends, so regressions ship unnoticed.

**Solution.** On every push to an Entire Trail, ArcherFish extracts requirements from the Trail and its sessions, lets a human approve or edit them, runs them as strict browser tests against a preview, and blocks the merge with an Entire finding when one fails.

**Prize targets (in order):** TinyFish "Hire Your First AI Employee" · MLH Best Use of Gemini API · MLH Best Use of Entire · Organizers' Choice: Most Adventurous.

**Constraints:** solo build, 12–15 usable hours, TypeScript.

## Status (Nov 21, evening)

Two sessions are building in parallel. **Product** owns this repo except `demo/`. **Demo** owns `demo/` and the separate repo `marcocharco/acme-pricing-demo`. See `HANDOFF.md` for the product side's run instructions.

**Done and verified**

- Entire set up on both repos (mirror, Trails, Gates with Agent Review at a medium threshold, approvals off). The gating loop works end to end: an open `high` finding blocks `merge`, resolving it clears the gate.
- Core seams, 21 unit tests: goal compiler, requirement extraction with citation checks, finding lifecycle (create, auto-resolve, reviewer override), verdict mapping (the agent's verdict decides, errored runs never pass).
- Adapters, verified live: Gemini (model fallback, backoff, quota errors fall through), TinyFish `agent.stream` in strict mode, Entire CLI findings.
- First live loop: Gemini compiled four requirements, TinyFish ran them in parallel on the live site, findings landed on a real Trail. Caught two true positives and one false failure, resolved through the override flow.
- Local Postgres schema and migrate script.
- Whole-Trail orchestrator (`lib/orchestrator.ts`, `scripts/orchestrate.mts <trail> [--watch]`): syncs a Trail and its sessions, extracts requirements, compiles, runs in a pool, persists to Postgres, files findings. Reviewed, not yet run against the demo Trail.
- ACME pricing page fixture in `target/` with four conditional bugs and a bug-free control build (verified in Chrome). The two hosted copies still show the old design and need a redeploy.
- Demo kit in `demo/`: static ACME seed, three scripted sessions, answer key, driver with session isolation, Chrome verifier.
- Demo repo: seed pushed, session 1 run through a real headless Claude Code and merged as Trail #3 (PR #1). Entire linked the session to the Trail on its own, and the checkpoint scanned clean.

**In progress**

- Getting the four bugs to land in session 2 (see "Demo repo and scripted sessions").

**Left, demo side**

1. Land the bugs, run the real session 2 on `feat/annual-volume`, scan the checkpoint, open the demo Trail (#4) and leave it open.
2. Deploy the buggy branch to Vercel as the "live site" target (treated as staging in the pitch).
3. Run the fix session (session 3) ahead of time, verify with `--expect correct`, redeploy for the green re-run. Keep it ready for the fix beat.
4. Record the demo-repo facts for the product session (Trail numbers, URL, repo path) and merge the `demo-kit` branch to `main` at a clean boundary.

**Left, product side (priority order below)**

- Run the orchestrator live on the demo Trail end to end.
- Bug report levels 1 and 2 with Markdown export, reviewer override, Brain write-back on approve.
- Dashboard: requirements workspace, live grid, replay page (needs step screenshots from the TinyFish runs API).
- `entire why` prompt attribution, Graph token-savings measurement, Trail merge-recommendation comment, the prevention beat, URL mode on a real site.
- Eval: TinyFish vs a Claude browser agent on the buggy and control builds.

**Left, shared and submission**

- Check the Gemini key is on a billed project (it was on the free tier, 20 requests a day per model).
- Scan every checkpoint for emails and keys before any `entire checkpoint push`. Eight early checkpoints on `qa-agent` contain a personal email, a known and accepted exposure.
- Rehearsal, backup video, cached results, Devpost write-up (it must say the demo chat history is scripted), X or LinkedIn post tagging TinyFish.

## Decisions

Agreed in Q&A on Nov 21. Rows marked *assumed* were not answered and can be changed.

| Topic | Decision |
| --- | --- |
| Project | AI QA tool (not CarPool Chaos) |
| Team / time / stack | Solo, 12–15 hours, TypeScript |
| Demo target | ACME, a SaaS pricing page in `target/` with Pro and Team cards ("add annual billing and volume pricing"), no login, with planted bugs. Replaced the toy shop on Nov 21. |
| Coding agent | Claude Code, sessions captured by Entire |
| UI | Full dashboard: requirements workspace, live run view, replay page, trail history |
| Requirement control | Human can approve, edit and add requirements |
| Trigger | Auto on Trail push (`entire trail watch`) plus a manual "Run now" button |
| PR runs | Each Trail push runs that Trail's new requirements plus a regression suite from all merged Trails *(interpreted from "on PR, like a PR workflow")* |
| Other entry point | Test any live URL with typed requirements, also producing tickets |
| Bug output | Copy-as-Markdown report (Jira, GitHub, Claude Code); integrations later |
| Fix loop | Lowest priority: a pasteable summary for Claude Code, no auto-fix |
| Entire | Core of PR mode; use as many features as possible (Trails, Sessions, Graph, Brain, `why`) |
| Brain | Approved requirements are written to Brain automatically |
| Attribution | Zoomable bug report, from summary down to the prompt that introduced the bug |
| Storage | Local Postgres (Homebrew postgresql@17). Tiger Data dropped Nov 21. |
| Re-push behaviour | *Assumed:* keep approved and edited requirements, mine only new messages, flag superseded ones |
| Frontend | *Assumed:* Next.js + Tailwind + shadcn/ui in one repo |
| Name | *Assumed:* ArcherFish |
| Pitch | "Your agent chats are your test suite" |
| Stretch, in order | Gemini root cause (file/line), Playwright repro export, exploratory mode |

## Long-term use case: incident response

A company's on-call is paged after an error is logged. An agent drafts a fix PR (a Trail). ArcherFish runs on that Trail automatically, so the on-call engineer opens the PR and sees an eval already done: which requirements pass, which fail, replays, and the prompt behind each failure. They no longer test the fix by hand. This is why Trail mode is triggered by any push, human or agent, and why the review and override flow is non-blocking by design. Not built for the hackathon, but the pitch and Trail mode must not preclude it.

## Decisions added in grilling (Nov 21)

- Everything in the stretch list (levels 3 to 5) is now MVP, ranked by priority. Cut order from the bottom: history chart, then polish and token numbers, then Graph root cause.
- Planted bugs (conditional and realistic, not visible on the happy path), toggled by `target/bugs.json`, with a bug-free control build (`NEXT_PUBLIC_NO_BUGS=1`). Pricing rules: Pro $19/seat; Team $29/seat, minimum 3 seats, 5% off at 10 or more seats; annual is 20% off; coupon SAVE10 is 10% off, applied after annual and volume. Bugs: (A, the regression) `couponMissesTeamAnnual`: SAVE10 silently does nothing on Team in annual mode; (B) `volumeDiscountOffByOne`: the 5% volume discount starts at 11 seats, not 10; (C) `teamMinSeatsDisplayOnly`: pressing minus below 3 shows 3 seats but prices 1 or 2; (D) `annualCouponWrongBase`: in annual mode the coupon is taken off the pre-annual price, so Pro 5 seats annual shows $798.00 instead of $820.80. Verified in Chrome on both builds: buggy vs control values are B $290.00 vs $275.50, C $29.00 vs $87.00, D $798.00 vs $820.80, A $835.20 vs $751.68. Chat lines such as "10 or more seats should get 5% off", "Team needs at least 3 seats", "annual should be 20% cheaper and the coupon should still work".
- Seed one merged "base pricing" Trail (Pro and Team cards, seats, coupon), then the demo Trail, so regression is visible.
- Failures create an Entire finding. A reviewer can override ("not a bug, this run" or "requirement is wrong"), which resolves it. A passing re-push auto-resolves it. No auto-retry.
- Extraction caching is not needed yet, but the design must allow it if results are inconsistent.
- Gemini does four jobs: extraction, goal compiling (careful QA-agent prompting), plain-English repro, root-cause triage.
- Target is a hosted preview per branch (like a staging link). The tunnel is a fallback only.
- Size: about 10 requirements per feature, with a run queue for concurrency limits.
- Sessions are matched to Trails by checkpoints in `git log base..head`, with a manual attach override.
- **Eval (required, scheduled later):** TinyFish vs a Claude browser agent (Agent SDK plus Chrome DevTools MCP) on the same requirements, on buggy and control builds, N=5 runs. Metrics: detection rate, false positives, consistency, time, cost, failing-step accuracy. Browser backends sit behind a `Runner` interface.
- TinyFish beta enrollment: done. Also request a higher concurrency limit.

## Differentiation and trust (Nov 21, after comparing with TestSprite)

TestSprite (testsprite.com) writes and maintains tests from a brief, PRDs or tickets, and keeps them "current as the interface changes". ArcherFish differs in where the requirements come from: nobody briefs anything, they are mined from what the team already told its agents, and they are anchored to that intent, not to the UI. A regression therefore stays a regression instead of being healed into the new normal. The moat is the **automatic** part: no one writes tests, and drift is handled by the system.

Added to scope, in priority order:

1. **Trustworthy verdicts.** One browser session per feature, with the feature's requirements as sequential checks (done). A pass must quote what the agent saw (done). Store the raw agent output for every run. A check the agent skipped or did not report is retried once in its own session. A failure is confirmed by a second run before a finding is filed; if the two runs disagree the check is shown as "needs review" and files nothing. Each failure is classified as a real bug, a test problem (the agent could not do the steps) or an environment problem (site down, timeout).
2. **Drift.** When a new chat message contradicts or changes an approved requirement, ArcherFish proposes superseding it and shows the old and new wording side by side with both receipts. Never silent. Extraction gets a "changes requirement X" output. This is the headline "auto" beat of the demo.
3. **Prompt attribution** (`entire why`, levels 4 and 5 of the bug report).
4. **Trail comment** with a merge recommendation ("does the change match the intent?").
5. **Nightly regression run** of all merged Trails against a target URL, with a morning summary.
6. **Coverage view:** which stated asks have no test and which are untestable, per Trail.

Skipped on purpose: backend and API tests, Jira, Linear and Slack integrations, a standalone CLI, IDE MCP. Copy as Markdown, "Copy for Claude Code" and Brain recall cover those roles.

Status (Nov 21, late): items 1 to 6 are implemented and committed on `main`. Not yet verified live: the second-run confirmation (needs a TinyFish run), drift extraction (needs Gemini), wiring attribution into bug reports (needs Gemini triage to supply the file and line; `scripts/attribute.mts <file:line>` already traces bug B to prompt 02/08 and bug D to 02/09). The nightly script is `scripts/nightly.mts`.

Findings from the first live runs on the demo Trail (Nov 21): the agent echoed the expected values from the goal and passed a real bug (fixed by requiring quoted observations), misread a page value once, and silently dropped checks in a multi-check session. These are the reasons for item 1.

## Dashboard v2: agreed features (Nov 21, after the prototype round)

The first dashboard stacked everything vertically, so a visitor did not know what to look at. Decisions after four layouts were compared (the "Focus" layout won):

**Two views, two jobs**

1. **Run view (the "Focus" layout).** Watch the agent work and read the outcome, mostly visually and not through text.
   - A task list grouped by feature, short labels, and a status icon on each task: spinner (running), check (pass), cross (fail), flag (flaky, needs a look), dash (not run), warning (no verdict).
   - The live browser preview stays the main area. It follows the active feature session, with small session thumbnails (each with its status icon) to switch or pin one.
   - Page level state is a segmented progress bar and one colored verdict badge (green, red, amber). No status sentence.
2. **Requirements view.** Review and edit in aggregate: a table grouped by feature with status, confidence and source, the chat quote behind each row, inline edit, approve, reject, bulk approve of high confidence asks, add your own, drift shown old against new with "Approve change", untestable asks greyed out with the reason, coverage gaps.

**Review after a run is a replay of what went wrong.** For now, reviewing results means replaying the failed and flaky checks: the steps the agent took as a filmstrip with its action text and duration, the failing step highlighted, expected against what it saw, and the recording. Everything else (editing requirements) lives in the Requirements view.

**Flow:** push, extract, (optional) review, run, replay failures, fix, re-run only the failed checks plus the regression suite, gate opens, merge happens in Entire. Approved requirements then join the regression suite and Brain.

**Decisions**
- **Runs do not wait for approval.** Unreviewed requirements run, but their failures are non-blocking until a human approves; approval is what makes a failure block the merge. (Needs checking: whether Entire can change a finding's severity, otherwise the finding is re-filed on approval.)
- **No merge from the app.** ArcherFish shows the gate status only. Merging stays in Entire.
- **Trail home page:** a list of Trails as status cards (needs review, running, failing, ready to merge).

**Replay data (verified Nov 21).** `GET /v1/runs/{id}` on a finished run returns `steps` (id, timestamp, action, duration, screenshot URL) and a `video_url`. The screenshot is fetched per step from `/v1/runs/{id}/steps/{stepId}/screenshot`. The `video_url` is presigned and expires, so the orchestrator must download the screenshots and the video as soon as a run ends, then store the paths in `steps.screenshot_path` and `checks.video_path`. The SDK's typed run object hides `steps` and `video_url`, so call the REST endpoint directly with the API key.

**Build order:** 1) capture replay data at run end, 2) replay view for failed and flaky checks, 3) Run view with status icons and session switching, 4) Requirements view, 5) Trail home page, 6) severity by approval.

**Status (Nov 21, night): all six built and committed.** Replay data is captured at the end of each session (`lib/replay.ts`, files under `data/replays/`, `scripts/backfill-replay.mts` for older runs). The bug report shows the replay. The Run view is the Focus layout at `/t/<trail>` with status icons, a progress bar, a verdict badge, session chips and a preview that is live while running and a replay once finished. Requirements live at `/t/<trail>/requirements` (filters, bulk approve of high confidence asks, drift cards). `/` lists Trails as status cards. Failures of unreviewed requirements are filed `low` and promoted to `high` on approval (`lib/gate.ts`, verified live against Entire). Run start time: Gemini calls take 20 to 25 seconds on the free tier, so compiled goals are cached per requirement text and prompt version (`compileCached`), and a feature's requirements compile in parallel. Known gaps: short labels are the first clause of each sentence until a stored `title` exists, and the agent cannot press the demo site's `aria-disabled` minus button, so bug C is still not caught.

## Prize alignment

- **Entire:** uses Trails (trigger, gate, merge recommendation), Sessions (requirement source), Brain (write on approve, recall in the prevention beat), Graph (token-savings measurement) and `why`. ArcherFish itself is built on Entire, with a Trail per feature and sessions captured.
- **TinyFish:** the job is QA. Strict-mode parallel browsers, a live-site beat in URL mode, and the eval against a Claude browser agent as evidence of smart use. The demo is posted on X or LinkedIn tagging TinyFish.
- **Gemini:** extraction, goal compiling, repro writing and root-cause triage. Not optimized further.

## Spike findings (Nov 21)

- `entire trail sessions <trail> --json` lists the sessions behind a Trail's commits. The checkpoint-matching heuristic is now only a fallback.
- Findings are agent-native: `entire trail finding add|list|resolve|dismiss|reopen`, with `--severity`, `--file`, `--line` and `--patch`. `trail show --json` exposes merge gates under `changes[].mergeability`.
- Trails must be enabled per repo by an admin (Settings > Trails on entire.com), otherwise `trail create` refuses.
- TinyFish TypeScript SDK is `@tiny-fish/sdk` (`client.agent.run` with `agent_config: { mode: "strict", max_steps }` and `output_schema`). Strict mode and `max_steps` are beta, and enrollment is done.
- A hosted Vercel preview needs the Deployment Protection bypass secret in the URL (`x-vercel-protection-bypass`). `COMPLETED` run status does not mean the test passed, so always read `result.passed`.
- **Gating loop verified end to end (hour-3 checkpoint passed for Entire).** With gates enabled and Agent Review set to a medium threshold, an open `high` finding fails the findings gate and `trail merge --dry-run` reports "not mergeable". Resolving the finding passes the gate. ArcherFish files failures as `high`. The approvals gate also blocks until someone runs `entire trail approve` (or approves in the UI), so the demo's "gate opens" beat needs that click. Bypass policy is "nobody".
- Findings have no title field, only a body, so ArcherFish puts the requirement text first in the body.
- TinyFish strict mode verified live: a wrong expectation returns `COMPLETED` with `passed: false`. The sync call returns no `streaming_url`, so the orchestrator must use async runs for the live grid.
- `gemini-3.8-flash` is the default model (`2.5-flash` is retired). Expect 503 overloads, so the adapter needs a retry and timeout.
- Commit author is the GitHub noreply address, so the public repo does not expose a personal email.

## Demo repo and scripted sessions (Nov 21)

The demo history lives in a separate repo, `marcocharco/acme-pricing-demo`, so ArcherFish watches a customer style repo and its regression suite is not polluted by ArcherFish' own development Trails.

- **Seed:** a static ACME pricing page (all the UI, no logic), committed first.
- **Session 1, Trail #3, merged:** a real headless Claude Code session with scripted developer prompts wires seats, the Team minimum and SAVE10 correctly. This is the regression suite. Entire links the session to the Trail (`entire trail sessions`). Project Trails share one number sequence across repos, and a merged change shows `phase: complete` while the Trail's `status` stays `open`, so key on the change being merged.
- **Session 2, the demo Trail (#4, left open):** adds annual billing, the Team volume discount and coupon handling, and ends with the four bugs. **Session 3** is the fix, run ahead of time and kept for the fix beat.
- **Live state (Nov 21):** Trail #4 "Annual billing and volume pricing" is open (change `acme-pricing-demo/2`, branch `feat/annual-volume`, session `592c31ad`). The buggy branch is deployed as the live site at `https://acme-pricing-demo.vercel.app` (public, no protection), verified with `check.mjs --expect buggy`. Use it as `TARGET_URL`. Trail #3 is the merged base pricing Trail.
- **Isolation:** the headless sessions run with the operator's plugins disabled through a gitignored local settings file, no Rex on `PATH`, and `--disable-slash-commands`. Without that, personal plugins leak into the transcript and skew the code.
- **Honesty:** the prompts are scripted by us. The write-up must say so.

**Finding: a vigilant agent will not plant a hidden bug from a contradictory prompt.** In session 2 the agent caught every contradiction and silently fixed it in favor of the earlier stated requirement ("one deviation from what you asked: `over: 9`, not `over: 10`", "a floor of 1 would let the raw count drop while the display stays at 3"). All four bugs failed to land, and the same was true of the `haiku` model. So the bugs now come from developer decisions stated explicitly (deferring the coupon on the volume path until finance confirms, a strict comparison, a raw seat state, a coupon computed from the list price), and if that is not enough, from a pasted patch. Each remains traceable to one prompt. This also makes a point for ArcherFish itself: agent code review caught the contradictions, but a stated shortcut is exactly what slips past.

## Users and modes

The primary user is a developer or small team shipping with coding agents on Entire. There are two entry points into the same engine.

**1. Trail mode (the main mode, works like a PR check).**

- Trigger: a push to an open Trail, or "Run now".
- Requirements = **new** (extracted from this Trail's title, description and linked session transcripts) + **regression** (approved requirements from all merged Trails).
- Target: the Trail's branch, run locally and exposed through a cloudflared tunnel.
- Output: a pass/fail per requirement, an Entire finding per failure (blocks the merge through the Findings gate), and a Markdown bug report.

**2. URL mode (test any live site).**

- Trigger: manual.
- Requirements: typed by the user, optionally seeded from merged Trails or `entire brain recall`.
- Target: any public URL.
- Output: the same pass/fail results and Markdown bug reports, with no gating.

## Core flow

&#91;embedded content: Trail mode flow · 8 steps, 1 decision, 1 fix loop\]

A failure produces a finding that blocks the merge plus a bug report; the fix comes back as a new push and only the test run repeats. Every TinyFish run uses strict mode with a `passed / failed_step / reason` output schema, and the verdict field, not the run status, decides pass or fail.

## Features

The dashboard has four screens. The bug report is the product's main output, so it gets the most care.

**Requirements workspace**

- One list per Trail, split into New and Regression.
- Each requirement: text, type (behaviour / validation / access / visual), confidence, testable yes/no, status (proposed / approved / rejected / superseded).
- A "receipt" chip opens the source chat message in context (Trail description or session transcript).
- Approve, reject, edit inline, add your own. Approving writes the requirement to Entire Brain.
- Untestable asks ("make checkout feel smoother") are shown greyed out with the reason, never tested.

**Live run view**

- A grid of live TinyFish browsers (`streaming_url`), one per requirement, each labelled with its requirement.
- A pass / fail / running badge per tile, plus overall progress.

**Bug report with zoom levels** (copyable as Markdown at any level)

1. **Summary:** requirement, verdict, one line on what went wrong.
2. **Repro:** plain-English numbered steps, expected vs actual, a filmstrip of step screenshots with the failing frame highlighted, and the saved video.
3. **Code:** likely file and line from Gemini triage, using `entire graph diff` and related graph queries *(stretch)*.
4. **History:** the commit and checkpoint behind that line, from `entire why --json` *(stretch)*.
5. **Prompt:** the exact prompt that introduced the bug, with surrounding transcript messages *(stretch)*.

Levels 3–5 show only when the data exists, so the report degrades cleanly to levels 1–2.

**Trail history**

- Runs per Trail and commit over time: pass rate, duration, failures.
- Stored in local Postgres, indexed by Trail and start time.

**Exports**

- Copy as Markdown (Jira, GitHub, Linear).
- "Copy for Claude Code": a compact problem summary with the repro, no instructions.
- Playwright repro script *(stretch)*.

## Entire integration

Entire is part of the product itself, not just the dev workflow. ArcherFish uses five Entire features, all through the CLI (`--json` output) called from Node.

| Feature | What ArcherFish does with it | Commands |
| --- | --- | --- |
| Trails | Source of intent; push trigger; finding gate that blocks the merge; list of merged Trails for regression | `trail show --json`, `trail watch --json`, `trail list --status closed --json`, `trail finding add/list/resolve`, `trail merge --dry-run` |
| Sessions | Transcripts become requirements with message-level citations | `session list --json`, `session info <id> --json --transcript` (or the transcript API for a uniform format) |
| Brain | Approved requirements become project rules Claude Code follows (prevention); URL mode seeds from existing rules | `brain remember "..." --path requirements.<slug>`, `brain recall`, `brain brief --json` |
| Graph | Narrows a failure to likely code without sending the repo to Gemini (token savings to measure) | `graph diff`, `graph query`, `graph impact` |
| why | Traces a file:line to the commit, checkpoint, prompt and session behind it | `why <file>:<line> --json` |

We also build ArcherFish itself with Entire (sessions captured, Trails per feature) and record token usage with `entire session tokens` for the Devpost write-up.

Sources: [Trails](https://docs.entire.com/guides/trails/overview.md), [trail CLI](https://docs.entire.com/cli-reference/trail.md), [gates](https://docs.entire.com/guides/trails/gates.md), [sessions CLI](https://docs.entire.com/guides/sessions/inspect-sessions-in-cli.md), [Brain](https://docs.entire.com/guides/brain/overview.md), [Graph](https://docs.entire.com/guides/graph/use-graph.md), [why](https://docs.entire.com/cli-reference/why.md).

## Architecture and data model

&#91;embedded content: ArcherFish architecture · 7 components\]

Everything runs on your laptop in one TypeScript repo: Next.js serves the dashboard and API routes, and a long-running Node worker does the orchestration. TinyFish browsers reach the toy shop through the tunnel.

**Stack:** Next.js + Tailwind + shadcn/ui · Node worker (`child_process` for the Entire CLI) · `@google/genai` with JSON-schema output · TinyFish TypeScript SDK · local Postgres · `cloudflared` quick tunnel.

**Data model**

| Table | Key fields |
| --- | --- |
| trails | id, title, description, branch, state (open/merged), last\_head\_sha |
| requirements | id, trail\_id, text, type, confidence, testable, status, source\_kind (description/session/manual), source\_session\_id, source\_message\_id, quote, brain\_path, edited\_by\_human |
| runs | id, trail\_id, head\_sha, started\_at, finished\_at, passed\_count, failed\_count |
| checks | id, run\_id, requirement\_id, tinyfish\_run\_id, goal, passed, failed\_step, reason, streaming\_url, video\_path, duration\_ms |
| steps | check\_id, index, action, purpose, screenshot\_path |
| bug\_reports | id, check\_id, finding\_id, summary\_md, repro\_md, file, line, commit\_sha, checkpoint\_id, prompt\_session\_id, prompt\_message\_id |

## Scope and build plan

The MVP is one complete Trail loop: push, extract, approve, run, fail, report, block. Everything else waits until that loop works end to end.

**MVP (must ship)**

- Trail mode: watch, extract with citations, approve/edit/add, parallel strict runs, findings that gate the merge
- Regression suite from merged Trails
- Bug report levels 1–2 with Markdown export
- Brain write-back on approve
- Dashboard: workspace, live grid, replay page, basic history

**Priority order (updated Nov 21).** One ranked list replaces the MVP/stretch split. If behind by an hour, cut from the bottom.

1. Spike and a **thin vertical slice** (see build plan checkpoint) [done]
2. Pricing page target with bug manifest and control build, hosted preview, base and demo Trails [target and base Trail done, demo Trail in progress]
3. Orchestrator: extraction, goal compiler, parallel runs, results stored [implemented, not yet run live on the demo Trail]
4. Bug report levels 1 to 2, findings, review and override, Brain write-back on approve [partial: finding logic done, report, override UI and Brain todo]
5. Dashboard: workspace, live grid, replay page [todo]
6. `entire why` and prompt attribution (levels 4 to 5) [todo, needs the demo Trail]
7. **Graph token-savings measurement** (triage with and without `entire graph`, report the numbers) [todo]
8. Trail comment with merge recommendation ("does the change match the intent?") [todo]
9. **Prevention beat for the demo:** a fresh Claude Code session recalls the requirement from Brain and avoids the bug [todo]
10. **URL mode against a real live site** as one short demo beat [todo]
11. **Eval:** TinyFish vs Claude browser agent (required before submission, scheduled later) [todo]
12. Gemini root cause (level 3) [todo]
13. Token numbers, polish [todo]
14. Trail history chart (plain table until then) [todo]

Nice-to-have, only if time remains: nightly scheduled regression run with a morning report (the "AI employee" framing), Playwright repro export, exploratory mode.

**Decided against:** Gemini screenshot second-opinion verifier. Gemini stays at four jobs, so the Gemini prize is a lower priority and not optimized for.

**Out of scope:** auth-protected targets, Jira/GitHub API integrations, auto-launching Claude Code fixes, multi-repo Trails, hosted deployment of ArcherFish itself.

**Original build plan (about 13.5 hours, superseded by the status section above, kept for reference)**

**Checkpoint at hour 3:** one real requirement must flow end to end: a chat line becomes an extracted requirement, TinyFish returns a verdict, and an Entire finding is created. If the Trail-to-session link or the finding gate fails here, switch to the fallbacks (manual session attach, local gate) immediately and rescope. Only then widen to the full plan below.

1. **Spike, 1.5 h:** enroll in TinyFish beta; `entire enable`; confirm `trail show/watch --json`, `finding add` from a plain script, Findings gate blocks `merge --dry-run`; one TinyFish run through a tunnel returning `passed:false`.
2. **Pricing page + demo Trail, 1 h:** Next.js pricing page with planted bugs; record real Claude Code sessions that state the requirements.
3. **Orchestrator core, 3 h:** watcher, Gemini extraction with citations, goal compiler, parallel TinyFish runs, results into Postgres.
4. **Reporting, 1.5 h:** findings, Markdown report, screenshot download, Brain write-back.
5. **Dashboard, 3 h:** workspace, live grid, replay page, simple history chart.
6. **Stretch, 1.5 h:** root cause with Graph, then `entire why`.
7. **Ship, 2 h:** rehearse demo, record backup video, Devpost write-up with token numbers, post demo on X/LinkedIn tagging TinyFish.

If you fall more than an hour behind, cut from the bottom of the priority order above: history chart, then polish, then Gemini root cause. The eval and Graph measurement are protected, as is the hour-3 checkpoint.

## Risks and open questions

The two biggest risks are the TinyFish beta gate and the undocumented link from Trail to sessions. Both get checked in the first 90 minutes.

| Risk | Impact | Fallback |
| --- | --- | --- |
| Strict mode and `max_steps` need TinyFish beta (403 without it) | Tests may click past bugs | Default mode + `max_duration_seconds` + a "stop on any deviation" goal |
| No documented way to find a Trail's sessions | No chat citations | Match sessions whose checkpoints fall in `git log base..head`; or `session current` in the Trail worktree |
| `finding add` may be refused from inside an agent session | No gating | Run the orchestrator as a plain process, never inside Claude Code |
| Browser runs take tens of seconds to minutes | Slow demo | Parallel `run-async`; cap at 4–6 requirements; pre-run before judging |
| AI verdicts flip between runs | Judges ask about reliability | Strict mode, screenshot evidence per verdict, Playwright export |
| `video_url` expires after 15 minutes | Broken replays | Download screenshots and video right after each run |
| Full dashboard, solo | Runs out of time | Cut order in the build plan |

**Open questions**

- [x] Which planted bugs, and which chat lines state them? Decided Nov 21, see Decisions.
- [ ] Does `trail show --json` include the description text and the merged state?
- [ ] What fields does a TinyFish run's `steps` list hold, and is the action text enough for plain-English repro steps?
- [ ] Which Gemini models for extraction vs triage (check current model list and free-tier limits)?
- [ ] Is an Entire account / project free for a hackathon repo?

Sources: [TinyFish QA on preview URLs](https://docs.tinyfish.ai/tinyagent/how-to/qa-preview-localhost.md), [agent modes](https://docs.tinyfish.ai/tinyagent/explanation/agent-modes.md), [runs](https://docs.tinyfish.ai/tinyagent/explanation/runs.md), [endpoints](https://docs.tinyfish.ai/tinyagent/api/agent/endpoints.md).

## Demo script (3 minutes)

The demo's turning point: "We never wrote a single test. We just talked to our agents."

1. **0:00 Hook.** Show a Trail and the Claude Code session behind it. Highlight casual lines like "oh and the cart should survive a refresh."
2. **0:20 Push.** The agent pushes. ArcherFish picks up the Trail and lists requirements, each with a receipt chip back to its chat line. Edit one live, add one by hand, approve.
3. **0:50 Run.** The live grid shows 4–6 TinyFish browsers testing the preview at the same time. One goes red.
4. **1:20 Report.** Open the bug report and zoom in: summary → repro steps and filmstrip → likely file/line → the prompt that introduced it.
5. **1:50 Gate.** Show the Trail: the finding blocks the merge. Copy the report into Claude Code; it fixes and pushes.
6. **2:20 Green.** The re-run passes, the gate opens, the Trail merges. The requirement is now in Brain and in the regression suite.
7. **2:40 Close.** Pitch line, prize stack (TinyFish, Gemini, Entire), token-savings number from Graph.

Backup: a recorded video of the full loop, plus pre-run results stored in case Wi-Fi or a run misbehaves.
