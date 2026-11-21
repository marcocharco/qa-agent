# Receipts — Product Spec

Nov 21, 2026 · @Marco Chen

## Summary

**Your agent chats are your test suite.** Receipts reads what a team told its coding agents (Entire Trails and session transcripts), turns it into plain-English requirements, tests them on the live app with parallel TinyFish browser agents, and returns bug reports with visual replays and the exact prompt that introduced each bug.

**Problem.** Teams building with coding agents state requirements in chat ("cart should survive a refresh") and never write them down. That intent is lost when the session ends, so regressions ship unnoticed.

**Solution.** On every push to an Entire Trail, Receipts extracts requirements from the Trail and its sessions, lets a human approve or edit them, runs them as strict browser tests against a preview, and blocks the merge with an Entire finding when one fails.

**Prize targets (in order):** TinyFish "Hire Your First AI Employee" · MLH Best Use of Gemini API · MLH Best Use of Entire · Organizers' Choice: Most Adventurous · bonus: MLH Best Use of Tiger Data (run history storage).

**Constraints:** solo build, 12–15 usable hours, TypeScript.

## Decisions

Agreed in Q&A on Nov 21. Rows marked *assumed* were not answered and can be changed.

| Topic | Decision |
| --- | --- |
| Project | AI QA tool (not CarPool Chaos) |
| Team / time / stack | Solo, 12–15 hours, TypeScript |
| Demo target | A small toy shop built for the demo, no login, with planted bugs (bug list TBD) |
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
| Storage | Postgres on Tiger Data |
| Re-push behaviour | *Assumed:* keep approved and edited requirements, mine only new messages, flag superseded ones |
| Frontend | *Assumed:* Next.js + Tailwind + shadcn/ui in one repo |
| Name | *Assumed:* Receipts |
| Pitch | "Your agent chats are your test suite" |
| Stretch, in order | Gemini root cause (file/line), Playwright repro export, exploratory mode |

## Long-term use case: incident response

A company's on-call is paged after an error is logged. An agent drafts a fix PR (a Trail). Receipts runs on that Trail automatically, so the on-call engineer opens the PR and sees an eval already done: which requirements pass, which fail, replays, and the prompt behind each failure. They no longer test the fix by hand. This is why Trail mode is triggered by any push, human or agent, and why the review and override flow is non-blocking by design. Not built for the hackathon, but the pitch and Trail mode must not preclude it.

## Decisions added in grilling (Nov 21)

- Everything in the stretch list (levels 3 to 5) is now MVP, ranked by priority. Cut order from the bottom: history chart, then polish and token numbers, then Graph root cause.
- Planted bugs: a bug manifest toggles each bug, plus a bug-free control build. Initial list: cart lost on refresh, discount applied twice. The list can change later.
- Seed one merged "base shop" Trail, then the demo Trail, so regression is visible.
- Failures create an Entire finding. A reviewer can override ("not a bug, this run" or "requirement is wrong"), which resolves it. A passing re-push auto-resolves it. No auto-retry.
- Extraction caching is not needed yet, but the design must allow it if results are inconsistent.
- Gemini does four jobs: extraction, goal compiling (careful QA-agent prompting), plain-English repro, root-cause triage.
- Target is a hosted preview per branch (like a staging link). The tunnel is a fallback only.
- Size: about 10 requirements per feature, with a run queue for concurrency limits.
- Sessions are matched to Trails by checkpoints in `git log base..head`, with a manual attach override.
- **Eval (required, scheduled later):** TinyFish vs a Claude browser agent (Agent SDK plus Chrome DevTools MCP) on the same requirements, on buggy and control builds, N=5 runs. Metrics: detection rate, false positives, consistency, time, cost, failing-step accuracy. Browser backends sit behind a `Runner` interface.
- TinyFish beta enrollment: done. Also request a higher concurrency limit.

## Prize alignment

- **Entire:** uses Trails (trigger, gate, merge recommendation), Sessions (requirement source), Brain (write on approve, recall in the prevention beat), Graph (token-savings measurement) and `why`. Receipts itself is built on Entire, with a Trail per feature and sessions captured.
- **TinyFish:** the job is QA. Strict-mode parallel browsers, a live-site beat in URL mode, and the eval against a Claude browser agent as evidence of smart use. The demo is posted on X or LinkedIn tagging TinyFish.
- **Gemini:** extraction, goal compiling, repro writing and root-cause triage. Not optimized further.
- **Tiger Data:** Postgres run history, a free bonus.

## Spike findings (Nov 21)

- `entire trail sessions <trail> --json` lists the sessions behind a Trail's commits. The checkpoint-matching heuristic is now only a fallback.
- Findings are agent-native: `entire trail finding add|list|resolve|dismiss|reopen`, with `--severity`, `--file`, `--line` and `--patch`. `trail show --json` exposes merge gates under `changes[].mergeability`.
- Trails must be enabled per repo by an admin (Settings > Trails on entire.com), otherwise `trail create` refuses.
- TinyFish TypeScript SDK is `@tiny-fish/sdk` (`client.agent.run` with `agent_config: { mode: "strict", max_steps }` and `output_schema`). Strict mode and `max_steps` are beta, and enrollment is done.
- A hosted Vercel preview needs the Deployment Protection bypass secret in the URL (`x-vercel-protection-bypass`). `COMPLETED` run status does not mean the test passed, so always read `result.passed`.
- Commit author is the GitHub noreply address, so the public repo does not expose a personal email.

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
- Stored as time series in Tiger Data.

**Exports**

- Copy as Markdown (Jira, GitHub, Linear).
- "Copy for Claude Code": a compact problem summary with the repro, no instructions.
- Playwright repro script *(stretch)*.

## Entire integration

Entire is part of the product itself, not just the dev workflow. Receipts uses five Entire features, all through the CLI (`--json` output) called from Node.

| Feature | What Receipts does with it | Commands |
| --- | --- | --- |
| Trails | Source of intent; push trigger; finding gate that blocks the merge; list of merged Trails for regression | `trail show --json`, `trail watch --json`, `trail list --status closed --json`, `trail finding add/list/resolve`, `trail merge --dry-run` |
| Sessions | Transcripts become requirements with message-level citations | `session list --json`, `session info <id> --json --transcript` (or the transcript API for a uniform format) |
| Brain | Approved requirements become project rules Claude Code follows (prevention); URL mode seeds from existing rules | `brain remember "..." --path requirements.<slug>`, `brain recall`, `brain brief --json` |
| Graph | Narrows a failure to likely code without sending the repo to Gemini (token savings to measure) | `graph diff`, `graph query`, `graph impact` |
| why | Traces a file:line to the commit, checkpoint, prompt and session behind it | `why <file>:<line> --json` |

We also build Receipts itself with Entire (sessions captured, Trails per feature) and record token usage with `entire session tokens` for the Devpost write-up.

Sources: [Trails](https://docs.entire.com/guides/trails/overview.md), [trail CLI](https://docs.entire.com/cli-reference/trail.md), [gates](https://docs.entire.com/guides/trails/gates.md), [sessions CLI](https://docs.entire.com/guides/sessions/inspect-sessions-in-cli.md), [Brain](https://docs.entire.com/guides/brain/overview.md), [Graph](https://docs.entire.com/guides/graph/use-graph.md), [why](https://docs.entire.com/cli-reference/why.md).

## Architecture and data model

&#91;embedded content: Receipts architecture · 7 components\]

Everything runs on your laptop in one TypeScript repo: Next.js serves the dashboard and API routes, and a long-running Node worker does the orchestration. TinyFish browsers reach the toy shop through the tunnel.

**Stack:** Next.js + Tailwind + shadcn/ui · Node worker (`child_process` for the Entire CLI) · `@google/genai` with JSON-schema output · TinyFish TypeScript SDK · Postgres on Tiger Data (hypertable for runs) · `cloudflared` quick tunnel.

**Data model**

| Table | Key fields |
| --- | --- |
| trails | id, title, description, branch, state (open/merged), last\_head\_sha |
| requirements | id, trail\_id, text, type, confidence, testable, status, source\_kind (description/session/manual), source\_session\_id, source\_message\_id, quote, brain\_path, edited\_by\_human |
| runs | id, trail\_id, head\_sha, started\_at, finished\_at, passed\_count, failed\_count (time series) |
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

1. Spike and a **thin vertical slice** (see build plan checkpoint)
2. Toy shop with bug manifest and control build, hosted preview, base and demo Trails
3. Orchestrator: extraction, goal compiler, parallel runs, results stored
4. Bug report levels 1 to 2, findings, review and override, Brain write-back on approve
5. Dashboard: workspace, live grid, replay page
6. `entire why` and prompt attribution (levels 4 to 5)
7. **Graph token-savings measurement** (triage with and without `entire graph`, report the numbers)
8. Trail comment with merge recommendation ("does the change match the intent?")
9. **Prevention beat for the demo:** a fresh Claude Code session recalls the requirement from Brain and avoids the bug
10. **URL mode against a real live site** as one short demo beat
11. **Eval:** TinyFish vs Claude browser agent (required before submission, scheduled later)
12. Gemini root cause (level 3)
13. Token numbers, polish
14. Trail history chart (plain table until then)

Nice-to-have, only if time remains: nightly scheduled regression run with a morning report (the "AI employee" framing), Playwright repro export, exploratory mode.

**Decided against:** Gemini screenshot second-opinion verifier. Gemini stays at four jobs, so the Gemini prize is a lower priority and not optimized for.

**Out of scope:** auth-protected targets, Jira/GitHub API integrations, auto-launching Claude Code fixes, multi-repo Trails, hosted deployment of Receipts itself.

**Build plan (about 13.5 hours)**

**Checkpoint at hour 3:** one real requirement must flow end to end: a chat line becomes an extracted requirement, TinyFish returns a verdict, and an Entire finding is created. If the Trail-to-session link or the finding gate fails here, switch to the fallbacks (manual session attach, local gate) immediately and rescope. Only then widen to the full plan below.

1. **Spike, 1.5 h:** enroll in TinyFish beta; `entire enable`; confirm `trail show/watch --json`, `finding add` from a plain script, Findings gate blocks `merge --dry-run`; one TinyFish run through a tunnel returning `passed:false`.
2. **Toy shop + demo Trail, 1 h:** Next.js shop with planted bugs; record real Claude Code sessions that state the requirements.
3. **Orchestrator core, 3 h:** watcher, Gemini extraction with citations, goal compiler, parallel TinyFish runs, results into Tiger Data.
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

- [ ] Which planted bugs, and which chat lines state them? (deferred by Marco)
- [ ] Does `trail show --json` include the description text and the merged state?
- [ ] What fields does a TinyFish run's `steps` list hold, and is the action text enough for plain-English repro steps?
- [ ] Which Gemini models for extraction vs triage (check current model list and free-tier limits)?
- [ ] Is an Entire account / project free for a hackathon repo?

Sources: [TinyFish QA on preview URLs](https://docs.tinyfish.ai/tinyagent/how-to/qa-preview-localhost.md), [agent modes](https://docs.tinyfish.ai/tinyagent/explanation/agent-modes.md), [runs](https://docs.tinyfish.ai/tinyagent/explanation/runs.md), [endpoints](https://docs.tinyfish.ai/tinyagent/api/agent/endpoints.md).

## Demo script (3 minutes)

The demo's turning point: "We never wrote a single test. We just talked to our agents."

1. **0:00 Hook.** Show a Trail and the Claude Code session behind it. Highlight casual lines like "oh and the cart should survive a refresh."
2. **0:20 Push.** The agent pushes. Receipts picks up the Trail and lists requirements, each with a receipt chip back to its chat line. Edit one live, add one by hand, approve.
3. **0:50 Run.** The live grid shows 4–6 TinyFish browsers testing the preview at the same time. One goes red.
4. **1:20 Report.** Open the bug report and zoom in: summary → repro steps and filmstrip → likely file/line → the prompt that introduced it.
5. **1:50 Gate.** Show the Trail: the finding blocks the merge. Copy the report into Claude Code; it fixes and pushes.
6. **2:20 Green.** The re-run passes, the gate opens, the Trail merges. The requirement is now in Brain and in the regression suite.
7. **2:40 Close.** Pitch line, prize stack (TinyFish, Gemini, Entire), token-savings number from Graph.

Backup: a recorded video of the full loop, plus pre-run results stored in case Wi-Fi or a run misbehaves.
