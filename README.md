# ArcherFish

Your agent chats are your test suite. ArcherFish reads what a team told its coding agents (Entire Trails and session transcripts), turns it into plain-English requirements, tests them on the live site with parallel TinyFish browser agents, files Entire findings that gate the merge, and explains each failure: a replay with the wrong value boxed, the likely line of code, and the exact prompt that introduced it.

## Run it

```
cp .env.example .env.local     # TinyFish, Gemini, Postgres, target repo and URLs
npm install
npm run db:migrate
npm run dev -- -p 3100         # dashboard on http://localhost:3100
```

Do not export `TINYFISH_API_KEY` or `GEMINI_API_KEY` in your shell profile: an exported variable overrides `.env.local`.

- Open a Trail, review its requirements (Requirements tab), press Run now. Run view shows the live browsers, then replays.
- `npx tsx --env-file=.env.local scripts/orchestrate.mts <trail number>` runs the same pipeline from the terminal.
- `/r/<trail id>` is the report page: why, what changed, proof, decisions. It copies as a PR description.
- Checks: `npm test`, `npm run typecheck`, `npx eslint .`.

## How it works

1. **Sync.** `entire trail show` and the Trail's sessions. Gemini extracts requirements with verbatim quotes; a later message that changes an earlier requirement is proposed as drift and never applied silently.
2. **Compile and run.** Each requirement becomes a strict-mode TinyFish goal. One browser session per feature runs its checks in order. Anything that does not pass gets a confirming session, and a bug needs two agreeing failures.
3. **Trust.** A pass must quote what the agent saw, and that quote is checked against the last screenshot. A session that returns no results is rerun.
4. **Report.** Failures become Entire findings (high once approved, low before), which block `entire trail merge`. Each failure gets a replay of logical steps, the failing value highlighted, a likely line (Gemini over Entire Graph query results), and the prompt behind it (`entire why`).

`SPEC.md` has the decisions and status. `demo/` is the scripted chat history used for the demo, and `HANDOFF.md` has the demo repo facts.
