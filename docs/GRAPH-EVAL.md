# Graph eval: does Entire Graph give the triage model less to read?

Generated 2026-11-22T08:01:04.626Z by `scripts/graph-eval.mts`. Model `gemini-3.8-flash`, 4 planted bugs x 2 repeats x 3 kinds of code context. Token counts are what Gemini reports for the prompt (`usageMetadata.promptTokenCount`), not an estimate.

- **files**: every source file the branch changed, whole, with line numbers (what ArcherFish sent before Graph).
- **diff**: the branch's unified diff with 10 lines of context (a fair, cheap baseline).
- **graph**: the regions `entire graph query` ranks for the failure.

| Code context | Mean prompt tokens | vs files | Points at the right line | Finds the right prompt (`entire why`) |
|---|---|---|---|---|
| files | 5973 | baseline | 8/8 | 7/8 |
| diff | 5196 | 13% fewer | 8/8 | 8/8 |
| graph | 2001 | 67% fewer | 8/8 | 8/8 |

## Per bug (mean prompt tokens)

| Bug | files | diff | graph | graph vs files |
|---|---|---|---|---|
| A | 5981 | 5204 | 1690 | 72% fewer |
| B | 5972 | 5195 | 1833 | 69% fewer |
| C | 5960 | 5183 | 2768 | 54% fewer |
| D | 5977 | 5200 | 1711 | 71% fewer |

## Caveats

- The demo repo is small (three changed source files), so the absolute numbers are small. In a larger repo the files baseline grows with the change while a ranked query stays bounded, so the saving would be larger, but this eval does not show that.
- The failure descriptions come from the answer key (`demo/ANSWER_KEY.md`), which records what the buggy site really shows.
- Four bugs and a few repeats is a small sample. Read the percentages as a measurement on this repo, not a general constant.
