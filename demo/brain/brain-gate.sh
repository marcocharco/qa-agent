#!/bin/sh
# Brain's edit hook, as a gate. Brain finds the requirements recorded for the file about to be edited. When there are any,
# Claude Code is told to ask the human before the edit goes ahead, and the agent is shown the same requirements.
# Reads the PreToolUse event on stdin and answers in the hook envelope Claude Code expects.
out=$(entire brain hook pre-edit --claude-hook --budget 1200 2>/dev/null)
[ -z "$out" ] && exit 0
printf '%s' "$out" | python3 -c '
import json, sys
try:
    ctx = json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"]
except Exception:
    sys.exit(0)
if "[invariant]" not in ctx:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": ctx}}))
    sys.exit(0)
reason = "This file has recorded requirements. Check the change does not break them before approving:\n" + ctx
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": reason, "additionalContext": ctx}}))
'
