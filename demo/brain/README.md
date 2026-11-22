# Brain as a hard gate

Brain's own edit hook only shows an agent the requirements recorded for a file. `brain-gate.py` wraps that lookup so a change
to a file with recorded requirements ("invariants") is blocked until a person approves it. A plain "ask" was not enough: in
Claude Code's auto mode the permission classifier answers it, and the edit goes through. A deny holds in every mode.

How it behaves:
- Edit, Write, MultiEdit, NotebookEdit and shell commands that write to a file (`sed -i`, redirects, `tee`, `perl -i`, `mv`, `cp`,
  `git apply`, `patch`) are checked against Brain. Reads are not.
- If the file has recorded requirements, the change is denied. The agent is given the requirements and tells the user which one
  the change would break.
- To approve, the person types `! touch .claude/brain-approved` in the session. That runs in their shell, not as an agent tool
  call, and the approval lasts 10 minutes. The hook refuses any tool call that mentions that file, so the agent cannot approve itself.

Install in the demo repo (after `entire brain setup`):

```
mkdir -p .claude/hooks && cp brain-gate.py .claude/hooks/ && chmod +x .claude/hooks/brain-gate.py
echo ".claude/brain-approved" >> .git/info/exclude
```
Then point two PreToolUse hooks in `.claude/settings.json` at `python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/brain-gate.py"`:
the Brain one (matcher `Edit|Write|MultiEdit|NotebookEdit`) and a new one with matcher `Bash`. Re-running `entire brain setup`
can restore Brain's own command, so check after. Start a fresh Claude Code session after any change: hooks load at startup.

Limits: it is a path pattern, not a sandbox. A write the pattern does not recognise is not held, and an agent set on
getting around it could try. For the demo it covers the normal ways an agent edits.
