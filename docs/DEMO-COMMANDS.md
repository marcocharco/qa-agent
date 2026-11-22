# Terminal for the demo: Entire commands

Three tabs, set up before you start. Big font, nothing scrolling.

| Tab | Folder | Why |
|---|---|---|
| 1 "entire" | `/Users/marco/Developer/acme-buggy` | A checkout of the buggy branch (`feat/annual-volume`). `entire why` reads the files on disk, so it has to be this branch, not the fixed one. |
| 2 "claude" | `/Users/marco/Developer/acme-pricing-demo` | The demo repo with Brain set up, for the prevention beat. |
| 3 "proof" | `/Users/marco/Developer/hw13` | The ArcherFish repo: exact-prompt lookup and the proof script. |

Run every command once before you present, so nothing is slow on stage.

## Beat 1: the Trail and the chat behind it (tab 1)

```
entire trail show 4 --project gh/marcocharco
entire trail sessions 4 --project gh/marcocharco
entire checkpoint explain 01M8063PQ1FSBKS5SPFZ8Y1318 | head -30
```
The Trail is open, the session is Claude Code, and the checkpoint holds the conversation.

## Beat 4: which prompt wrote the buggy line (tabs 1 and 3)

```
entire why lib/pricing.ts:61                       # tab 1
TARGET_REPO_DIR=/Users/marco/Developer/acme-buggy \
  npx tsx --env-file=.env.local scripts/attribute.mts lib/pricing.ts:61    # tab 3
```
Be ready to explain the difference. `entire why` gives the commit, the checkpoint and the session, and shows that session's *first* prompt. ArcherFish then walks the transcript to find the exact message that wrote the line (prompt 02/08, "use a strict seats > volume.over"). The app's Prompt tab shows the same thing.

## Beat 5: the gate (tab 1, after the run has filed findings)

```
entire trail finding list 4 --project gh/marcocharco
entire trail merge 4 --project gh/marcocharco --dry-run
```
The findings gate should read "failed" and the Trail "not mergeable". If it says mergeable, the run has not filed findings yet, or `scripts/demo-state.mts restore <name>` needs running.

## Beat 6: the prevention beat (tab 2)

```
entire brain hook pre-edit --file lib/pricing.ts
```
This is what Brain knows about `lib/pricing.ts`: the requirements recorded for it. The demo repo's edit hook (`.claude/hooks/brain-gate.sh`, source in `demo/brain/`) turns that into a gate. Start a fresh Claude Code session in this folder and ask it to make the Team discount start above 10 seats. When it tries to edit `lib/pricing.ts`, Claude Code stops and asks you to approve, showing the recorded requirements, including "Team gets 5% off the subtotal at 10 or more seats". Decline, or approve to show the human stays in charge.

Say "Brain holds the edit until a human approves", and be accurate about the limit: it covers the edit tools, so an agent that edits through the shell is not stopped.

## If someone asks "is any of this hardcoded?" (tab 3)

```
npx tsx --env-file=.env.local scripts/entire-proof.mts | head -60
```
Everything is read live from the Entire CLI: quotes checked against real transcripts, four of four bugs traced to their prompts, two control lines that resolve to something else, the findings and the gate. The result is saved in `docs/ENTIRE-PROOF.md`.

Graph, if asked: `entire graph query --format agent --head "pressing minus at 3 seats changes the total price"` and the measurement in `docs/GRAPH-EVAL.md` (67 percent fewer prompt tokens).
