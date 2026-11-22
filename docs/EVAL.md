# Eval design: can an AI browser agent find the planted bugs, and how reliably?

Status: designed, not built or run. Nothing in this file has been measured yet.

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

> Given the same plain-English test, which browser agent reliably tells a broken page from a working one, and what do ArcherFish's safeguards add on top?

## 3. Ground truth

Two builds of the same page: the **buggy** build (`feat/annual-volume`, four planted bugs) and the **fixed** build (`feat/annual-volume-fixed`, none). The nine approved requirements are the tasks.

| Requirement | Buggy build should | Fixed build should |
|---|---|---|
| A. SAVE10 on Team, annual | fail | pass |
| B. 5% off at 10 seats | fail | pass |
| C. Team minimum 3 seats (minus button) | fail | pass |
| D. Annual comes first, then the coupon | fail | pass |
| The other five | pass | pass |

Before any run, `scripts/eval/truth.mts` runs `check.mjs` against both URLs and saves what each page really shows. If the oracle disagrees with the table above, the eval stops: we would be scoring against a wrong answer key.

## 4. Arms (the things we compare)

All three get the **identical task text**: the compiled check for the requirement, taken from the database cache (no model calls to build it).

1. **TinyFish, raw.** One strict-mode TinyFish run per check, taking its verdict at face value.
2. **Claude browser agent, raw.** Claude Code in headless mode driving a real Chrome through the Chrome DevTools MCP server, given the same task and asked for the same JSON answer. This is the "general agent" baseline the spec calls for.
3. **ArcherFish pipeline.** TinyFish plus what we added: a confirming second run for anything that did not pass (a bug needs two agreeing failures), a rerun when the agent returns nothing, and the screenshot check that overturns a pass the last screenshot contradicts.

Arm 3 is the interesting one. If it beats arm 1, our safeguards are earning their keep. If it does not, we have learned that honestly.

## 5. Procedure

For each arm, build and requirement, repeat **N** times (N=1 for a smoke test, then 3, then 5 if the budget allows). Each repeat is a fresh browser. Order is shuffled so time of day does not favour one arm. Every run is written to `data/eval/runs.jsonl` with: arm, build, requirement, repeat, verdict, what the agent says it saw, its reason, the failed step, seconds, steps, and cost.

## 6. Metrics

Per arm, on the buggy build (where there is something to find):

- **Detection rate**: runs that failed A, B, C or D, out of all runs of A, B, C, D.
- **Miss rate**: runs that passed A, B, C or D. This is the headline risk.
- **No-answer rate**: runs with no usable verdict.

On the fixed build and on the five non-bug requirements:

- **False alarm rate**: runs that reported a failure where nothing is wrong.

On both:

- **Consistency**: for each check, the share of repeats that agree with the majority.
- **Evidence accuracy**: when the agent quotes what it saw, does the quote contain the value the oracle read off the page? This catches the failure we found earlier, where an agent passed a check while quoting the expected number instead of the real one.
- **Cost and time per check.** TinyFish cost is steps x $0.016. Claude cost is its token usage.

Every rate is shown as `k of n` with a 95 percent interval. With a handful of runs the interval is wide, and the report says so instead of hiding it.

## 7. What this can and cannot show

- It shows reliability on **this** page with **these** four bugs. It does not show general QA ability.
- The bugs were planted to be findable by a browser agent. A real unknown bug could be harder.
- Small N means wide intervals. Three or five repeats can separate "usually works" from "often fails", not 92 percent from 95.
- The Claude arm depends on how well the MCP server and prompt are set up. We run a smoke test first so a setup mistake is not reported as the agent's failure.

## 8. Cost and time

Roughly 15 steps per check, 9 checks, 2 builds:

| Stage | Runs per arm | TinyFish cost (arms 1 and 3) | Notes |
|---|---|---|---|
| Smoke | N=1, buggy only | about $2 to $4 | Proves the harness and the Claude setup work |
| Main | N=3, both builds | about $30 | Fits inside the current $36 wallet, barely |
| Extended | N=5 | about $50 | Needs a top-up |

Time is about one concurrency round per batch at five browsers, so the main stage is on the order of an hour.

## 9. Build plan

- `eval/ground-truth.json`: the table in section 3.
- `scripts/eval/truth.mts`: runs the oracle on both builds and checks it against the table.
- `scripts/eval/runners.mts`: one `Runner` interface (`run(task, url) -> verdict, evidence, cost, seconds`) with three implementations.
- `scripts/eval/run.mts <N> [--smoke]`: executes the plan, appends to `runs.jsonl`, never stops on a failed run (it records the failure and carries on).
- `scripts/eval/report.mts`: reads `runs.jsonl`, writes `docs/EVAL-RESULTS.md` with the tables, intervals and a plain-language reading.

## 10. How we use the run to test the whole app

The pipeline arm exercises the real pieces: the cached compile, strict TinyFish sessions, the confirm logic, the screenshot verifier. Alongside it, `scripts/eval/smoke-app.mts` does one end-to-end pass of the product itself: extract from the Trail with Gemini, check the citations, run, file findings, triage, attribute with `entire why`, check the Brain memories, confirm the replay files exist. Problems found are written to `data/eval/issues.md` with a severity. Rule for the run: if a problem does not block the rest of the run, log it and keep going, then fix the confident ones afterwards.
