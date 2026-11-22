# ArcherFish: your agent chats are your test suite

## Inspiration
When you build with coding agents, the requirements live in the chat: "the minus button has to stop at 3", "SAVE10 works on both plans". Nobody writes them down as tests, so a later session quietly breaks them. TestSprite-style tools need you to brief them. We wanted tests nobody has to write, anchored to what the team actually asked for, so a regression stays a regression.

## What it does
ArcherFish reads an Entire Trail and its agent sessions, extracts the requirements with verbatim quotes, and tests them on the live site with parallel TinyFish strict-mode browser agents. A failing requirement becomes an Entire finding that blocks the merge. Each failure comes with a replay of the logical steps, the wrong value boxed on the screenshot, the likely line of code, and the exact prompt that introduced the bug. When a later message changes an earlier requirement, ArcherFish proposes the change for a human to approve instead of silently adopting it, so the bug is not accepted as the new spec. A report page (why, what changed, proof) is meant to replace the PR description.

## How we built it
- **Entire:** Trails (trigger and requirement source), sessions, findings and the merge gate, `why` for prompt attribution, Graph for what changed and for the code context in root-cause triage (about 63 percent fewer tokens than sending the changed files in our test).
- **TinyFish:** one strict-mode browser session per feature with several checks, a confirming session for anything that fails, replays from the run steps and screenshots.
- **Gemini:** requirement extraction with citations, goal compiling, root-cause triage, and a screenshot check on every pass.
- Next.js dashboard, Postgres, TypeScript orchestrator.

## Honest notes
- The demo's chat history is scripted: we wrote the developer prompts and ran real headless Claude Code sessions on them, so the code, the bugs and the Entire checkpoints are real, but the developer's messages are ours.
- Agents are not perfectly reliable. In our runs a browser agent sometimes returned no result and once reported the expected value instead of what the page showed. A pass is now checked against the last screenshot, an empty session is rerun, and a bug needs two agreeing failures. We caught three of the four planted bugs in every full run and the fourth in some.
- Runs are limited by our TinyFish concurrency of five browsers.

## What's next
Publishing the report into the pull request, running automatically on every push, and an eval of TinyFish against a general browser agent on the same requirements.
