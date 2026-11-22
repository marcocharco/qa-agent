# Brain as a gate

Brain's own edit hook only shows an agent the requirements recorded for a file. `brain-gate.sh` wraps it so that, when a
file has recorded requirements ("invariants"), Claude Code asks the human before the edit goes ahead.

Install in the demo repo (after `entire brain setup`):

```
mkdir -p .claude/hooks && cp <this folder>/brain-gate.sh .claude/hooks/ && chmod +x .claude/hooks/brain-gate.sh
```
and in `.claude/settings.json` point the `Edit|Write|MultiEdit|NotebookEdit` PreToolUse hook at
`sh "$CLAUDE_PROJECT_DIR/.claude/hooks/brain-gate.sh"`. Re-running `entire brain setup` can put Brain's own command back, so check after.

Limits: it covers the Edit, Write, MultiEdit and NotebookEdit tools. An agent that edits through the shell is not stopped.
