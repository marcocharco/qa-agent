# Eval design: can an AI browser agent find the planted bugs, and how reliably?

Status: designed and the harness built, but scaled back after a first spot check showed a Claude agent beating ArcherFish on cost and time for this page. See `docs/EVAL-SPOT-CHECK.md`. The full run is not planned.

## 1. What an eval is (read this first)

A unit test checks that code gives the same answer every time. An AI agent does not: ask it to do the same task twice and it can click differently, read the page differently, or give up. So "it worked once" proves nothing. An **eval** is an experiment built around that fact:

1. **A task set with known right answers** ("ground truth"). We know, from the answer key and from a script that does not use AI, which checks must fail on the buggy site and which must pass.
2. **Run the system many times** on every task, because one run is an anecdote.
3. **Score each run against the truth**, then report **rates** (for example "caught 9 of 10 runs"), not single results.
4. **Compare against a baseline**, otherwise a number like "90 percent" means nothing. Our baseline is another way of doing the same job.

Words you will see:

| Term | Meaning here |
|---|---|
| Ground truth | What is really on the page. We confirm it with `demo/verify/check.mjs`, a plain Playwright script with no AI in it. |
| Arm | One of the systems being compared. |
| Oracle | The thing that knows the right answer (the script above). |
| Detection rate (recall) | Of the runs where a bug exists, how many reported a failure. |
| Miss / false pass | A bug exists and the agent said it passed. The dangerous mistake. |
| False alarm (false positive) | No bug exists and the agent said it failed. Cries wolf. |
| No answer | The agent finished without a usable verdict. We saw this a lot. |
| Consistency | Across repeats of the same check, how often the agent gives the same verdict. |
| Contamination / leakage | Tuning the system on the same cases you then score it on, which flatters the result. We avoid it by never changing prompts after seeing eval results without saying so. |

## 2. The question

> A general-purpose Claude browser agent can run these tests too. Does ArcherFish find the planted bugs **just as reliably** while using **fewer credits and less time**?

This shapes how we read the results. We are not trying to prove ArcherFish is *smarter*. The claim is **same accuracy, cheaper and faster**. Evaluators call that a *non-inferiority* claim: accuracy only has to be no worse (within the margin our small sample can resolve), and the real win is measured in cost and time.

## 3. Ground truth

Two builds of the same page: the **buggy** build (`feat/annual-volume`, four planted bugs) and the **fixed** build (`feat/annual-volume-fixed`, none). The nine approved requirements are the tasks.

| Requirement | Buggy build should | Fixed build should |
|---|---|---|
| A. SAVE10 on Team, annual | fail | pass |
| B. 5% off at 10 seats | fail | pass |
| C. Team minimum 3 seats (minus button) | fail | pass |
| D. Annual comes first, then the coupon | fail | pass |
| The other five | pass | pass |

Before any run, `scripts/eval/truth.mts` runs `check.mjs` (plain Playwright, no AI) against both URLs and compares it to this table. If the oracle disagrees, the eval stops: we would be scoring against a wrong answer key.

## 4. The two arms

Both get the **identical task text**: the compiled check for the requirement, read from the database cache, so building the task costs nothing for either side.

1. **ArcherFish.** The real pipeline for one check: a strict TinyFish browser run, a rerun if it returns nothing, a confirming second run for anything that did not pass (a bug needs two agreeing failures), and the screenshot check that overturns a pass its own last screenshot contradicts. Its credits are TinyFish steps ($0.016 each) plus any Gemini calls.
2. **Claude browser agent.** Claude Code in headless mode driving a real Chrome through the Chrome DevTools MCP server, given the same task and asked for the same JSON answer. Its credits are the cost Claude Code reports for the run.

Both arms run five checks at a time, so wall-clock time is comparable.

## 5. Procedure

For each arm, build and requirement, repeat **N** times (N=1 for a smoke test, then 3, then 5 if the budget allows). Each repeat is a fresh browser. Order is shuffled so time of day does not favour one arm. Every run is written to `data/eval/runs.jsonl` with: arm, build, requirement, repeat, verdict, what the agent says it saw, its reason, the failed step, seconds, steps, and cost.

## 6. Metrics

**Held constant (the accuracy side, must not be worse):**

- **Detection rate**: on the buggy build, runs that failed A, B, C or D out of all runs of A, B, C, D.
- **Miss rate**: runs that passed one of those four. The dangerous mistake.
- **False alarm rate**: runs that reported a failure where nothing is wrong (the fixed build, and the five non-bug requirements on the buggy build).
- **No-answer rate**: runs with no usable verdict.
- **Consistency**: for each check, the share of repeats that agree with the majority.
- **Evidence accuracy**: when the agent quotes what it saw, does the quote contain the value the oracle read off the page?

**The thing we hope improves (the efficiency side):**

- **Credits per check**, in dollars: median and total, with each arm's extra work (confirming runs, retries) included.
- **Seconds per check**, and **wall-clock for the whole suite**.
- **Cost per bug found**: total spend divided by true detections. A cheap agent that misses bugs is not cheap.

Rates are shown as `k of n` with a 95 percent interval. Cost and time are shown as medians with the spread, plus a paired comparison (same check, same build, same repeat number, one arm against the other).

## 7. What this can and cannot show

- It shows reliability on **this** page with **these** four bugs. It does not show general QA ability.
- The bugs were planted to be findable by a browser agent. A real unknown bug could be harder.
- Small N means wide intervals. Three or five repeats can separate "usually works" from "often fails", not 92 percent from 95.
- The Claude arm depends on how well the MCP server and prompt are set up. We run a smoke test first so a setup mistake is not reported as the agent's failure.

## 8. Cost and time

Roughly 15 steps per check, 9 checks, 2 builds. ArcherFish also pays for its confirming runs.

| Stage | Runs per arm | ArcherFish (TinyFish) | Claude arm | Notes |
|---|---|---|---|---|
| Smoke | N=1, buggy only | about $3 to $5 | to be measured | Proves the harness and the Claude setup work |
| Main | N=3, both builds | about $20 to $30 | to be measured | Fits inside the current wallet |
| Extended | N=5 | about $35 to $50 | to be measured | Needs a top-up |

## 9. Build plan

- `eval/ground-truth.json`: the table in section 3.
- `scripts/eval/truth.mts`: runs the oracle on both builds and checks it against the table.
- `scripts/eval/runners.mts`: one `Runner` interface (`run(task, url)` returns verdict, evidence, credits, seconds) with the two implementations.
- `scripts/eval/run.mts <N> [--smoke]`: executes the plan five at a time, appends to `data/eval/runs.jsonl`, never stops on a failed run (it records the failure and carries on).
- `scripts/eval/report.mts`: reads the log, writes `docs/EVAL-RESULTS.md` with the tables, intervals and a plain-language reading.

## 10. Testing the app with it

The ArcherFish arm runs the real pieces: the cached compile, strict TinyFish sessions, the confirm logic and the screenshot verifier. Anything that breaks there during the eval is logged to `data/eval/issues.md` with a severity. If it does not block the rest of the run, the run carries on and the confident fixes are made afterwards.
