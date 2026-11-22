# Spot check: ArcherFish vs a Claude browser agent (one run each)

This replaces the larger eval in `docs/EVAL.md`, which was designed but not run beyond a harness test. One run each is an anecdote, not a statistic. Read it that way.

Both were pointed at the buggy build (`https://acme-pricing-demo.vercel.app`) with the same approved requirements.

| | ArcherFish (full run of the Trail) | Claude Code in a browser (Chrome DevTools MCP) |
|---|---|---|
| What it was given | The 8 compiled checks from the cache | The requirements in plain English, in a checkout of the branch, "you just built this" |
| Wall-clock | 646 s (about 10m 46s), 5 browsers at a time | 38 s |
| Credits | $4.02 of TinyFish (wallet before and after) | $0.114 (Claude Code's reported cost) |
| Bugs A, B, C, D | A, C, D confirmed as bugs. B flagged "needs review" (one failure, not confirmed) | All four found, each with the right numbers |
| False alarms | none | none |
| Requirements covered | 8 (a ninth could not be compiled: the Gemini spend cap was hit) | 9 |

## What this does and does not say

- A general Claude agent with a real browser was about **17 times faster and 35 times cheaper** on this small page, and found all four bugs. **The claim "ArcherFish uses fewer credits and is faster" is not supported by this data.** We should not make it.
- The Claude session had the code in front of it and is the kind of agent that built the feature, so it is not an independent tester, and it was told what to test. It is also one run.
- ArcherFish's cost is inflated by its own design: it reloads the page before every check (so the 9-seat and 10-seat checks each click up from scratch), it runs a confirming second session for anything that does not pass, and it reruns sessions that return nothing. About 190 steps went to the first pass alone.
- What ArcherFish does that this comparison does not test: it writes the tests itself from the team's agent chats, keeps them as the code changes, flags a later chat message that changes an earlier requirement, files findings that gate the merge, and traces each failure to the line and the prompt. A Claude agent only tests what it is told to test.

## Measured elsewhere

- Entire Graph gives the triage model 67 percent fewer prompt tokens than the changed files (61 percent fewer than a unified diff) with the same accuracy: `docs/GRAPH-EVAL.md`.
