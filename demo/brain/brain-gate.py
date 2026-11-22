#!/usr/bin/env python3
"""Brain as a gate. Before an agent changes a file, look up the requirements recorded for it in Entire Brain. If there are any,
Claude Code asks the human before the change goes ahead, and the agent is shown the same requirements.
Covers the edit tools and shell commands that write to files (sed -i, redirects, tee, perl -i, mv/cp, git apply, patch...)."""
import json, os, re, subprocess, sys, time

APPROVAL = ".claude/brain-approved"   # created by the human only: `! touch .claude/brain-approved`
VALID_FOR = 600                       # seconds

try:
    event = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool = event.get("tool_name", "")
inp = event.get("tool_input", {}) or {}
cwd = event.get("cwd") or os.getcwd()

files = []
if tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
    p = inp.get("file_path") or inp.get("notebook_path")
    if p:
        files.append(p)
elif tool == "Bash":
    cmd = inp.get("command", "")
    writes = re.search(r"(sed\s+(-[a-zA-Z]*i|--in-place)|\btee\b|>>?\s*\S|perl\s+(-[a-zA-Z]*i)|\bmv\b|\bcp\b|git\s+apply|\bpatch\b|open\([^)]*['\"]w|write_text|writeFile|\bdd\b)", cmd)
    if writes:
        # Anything in the command that looks like a source file path.
        files = re.findall(r"[\w./@-]+\.(?:tsx?|jsx?|css|json|md|mjs|cjs|html)", cmd)

def deny(reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}))
    sys.exit(0)

# The agent must not approve itself. A person types `! touch .claude/brain-approved`, which runs in their shell, not as an agent tool call.
if "brain-approved" in json.dumps(inp):
    deny("Only a human can approve a Brain hold. Ask the user to run it themselves.")

lines = []
for f in dict.fromkeys(files):
    try:
        out = subprocess.run(["entire", "brain", "hook", "pre-edit", "--file", f, "--budget", "1200"], cwd=cwd, capture_output=True, text=True, timeout=20).stdout
    except Exception:
        continue
    for l in out.splitlines():
        if "[invariant]" in l and l not in lines:
            lines.append(l)

if not lines:
    sys.exit(0)

root = event.get("cwd") or os.getcwd()
marker = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", root), APPROVAL)
if os.path.exists(marker) and time.time() - os.path.getmtime(marker) < VALID_FOR:
    # A person approved. The agent still sees the requirements.
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": "A human approved changes to files with these recorded requirements:\n" + "\n".join(lines)}}))
    sys.exit(0)

deny("Brain blocked this change. The file has recorded requirements, and a person has to approve changing them:\n" + "\n".join(lines) +
     "\n\nTell the user which requirement this change would break. To approve, the user types this in the session: ! touch .claude/brain-approved   (valid for 10 minutes). Do not try to create that file yourself and do not edit around this block.")
