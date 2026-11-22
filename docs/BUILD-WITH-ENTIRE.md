# How ArcherFish was built, from Entire

Read live from `entire session list --json` (2026-11-22). Entire tracked **8 Claude Code sessions** in this project while we built it, across 3 worktrees.

| Measure | Tokens |
|---|---|
| All tokens counted | 416.5M |
| of which re-read from cache | 411.1M (99%) |
| of which written to cache | 2.5M |
| Fresh input | 3k |
| **Output the models wrote** | **1195k** |

Read the totals carefully. Entire counts every token of every API call, and each call re-reads the whole conversation so far from the cache, so long sessions run into the hundreds of millions without that meaning hundreds of millions of tokens of new work. The number to quote for work done is output tokens. The number that shows why context matters is the cache share.

| Session | Worktree | Turns | Checkpoints | Output | All tokens | First line of the last prompt |
|---|---|---|---|---|---|---|
| `76fe9c39` | hw13-demo | 100 | 0 | 719k | 298.3M | Ok now that we have the terminal panes setup and a good run  |
| `92c2823b` | hw13 | 38 | 0 | 324k | 91.4M | split this pain into a new tab |
| `7c005118` | hw13 | 15 | 1 | 47k | 10.5M | right now team needs at least 3 seats, shows error overlay o |
| `773f5fcb` | hw13-ui | 9 | 0 | 68k | 9.8M | ok lets do that. Do we have the steps replay? |
| `9b6578fa` | hw13 | 8 | 0 | 23k | 4.1M | we updated the urls, check the urls again |
| `c4576545` | hw13 | 5 | 1 | 7k | 1.4M | ok can you test the api key now? |
| `a7b2e33a` | hw13 | 3 | 0 | 5k | 0.7M | just make the request then cancel it. i ned them to recieve  |
| `0799a0d9` | hw13-demo | 0 | 0 | 1k | 0.3M | Read demo/HANDOFF-DEMO.md, SPEC.md and demo/ANSWER_KEY.md, t |

Reproduce: `entire session list`, and `entire session tokens <session id>` for a per-session breakdown and Entire's own recommendations (for the long sessions it flags context replay as the main cost).
