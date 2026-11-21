#!/usr/bin/env bash
# Replays the scripted ACME sessions against a real headless Claude Code, one prompt at a time.
#
# usage: ./run-sessions.sh [--dry-run] [--yes] [--existing] <demo-repo-dir>
#   default: the dir must be empty (or only .git); the seed is copied in and committed first.
#   --existing: the dir is already a clean git repo (seed committed, branch checked out); only the sessions run.
#
# env:
#   SESSIONS       space separated session files to run (default: "01-base 02-annual-volume 03-fix")
#   PAUSE_BETWEEN  set to 1 to wait for Enter after each session (time to merge the Trail in between)
#   CLAUDE_MODEL   optional model alias or id passed to claude --model
#
# Safety: refuses unless the target dir is empty or only contains .git. Never pushes anything.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSIONS="${SESSIONS:-01-base 02-annual-volume 03-fix}"
TOOLS="Edit Write Read Bash(npm:*) Bash(npx:*) Bash(git:*)"
PERM="acceptEdits"

DRY=0; YES=0; EXISTING=0; TARGET=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --yes) YES=1 ;;
    --existing) EXISTING=1 ;;
    -*) echo "unknown flag $a" >&2; exit 2 ;;
    *) TARGET="$a" ;;
  esac
done
[ -n "$TARGET" ] || { echo "usage: $0 [--dry-run] [--yes] [--existing] <demo-repo-dir>" >&2; exit 2; }
[ -d "$TARGET" ] || { echo "refusing: $TARGET is not a directory" >&2; exit 1; }
TARGET="$(cd "$TARGET" && pwd)"

# Safety check.
if [ "$EXISTING" = 1 ]; then
  [ -d "$TARGET/.git" ] || { echo "refusing: --existing needs a git repo at $TARGET" >&2; exit 1; }
  if [ -n "$(git -C "$TARGET" status --porcelain)" ]; then echo "refusing: $TARGET has uncommitted changes" >&2; exit 1; fi
else
  extra="$(ls -A "$TARGET" | grep -vx '.git' || true)"
  if [ -n "$extra" ]; then
    echo "refusing: $TARGET is not empty. Found:" >&2
    echo "$extra" | head -5 | sed 's/^/  /' >&2
    exit 1
  fi
fi
[ "$TARGET" != "$HERE" ] && [ "$TARGET" != "/" ] && [ "$TARGET" != "$HOME" ] || { echo "refusing: unsafe target" >&2; exit 1; }

for c in claude git npm awk uuidgen; do
  command -v "$c" >/dev/null || { echo "missing required command: $c" >&2; exit 1; }
done

# Splits a session file into one text file per prompt: lines under "[n]" markers.
split_prompts() { # file outdir
  awk -v dir="$2" '/^\[[0-9]+\][ \t]*$/ { n++; f = sprintf("%s/%02d.txt", dir, n); printf "" > f; next } n > 0 { print > f }' "$1"
}

echo "== Plan =="
echo "target repo : $TARGET"
if [ "$EXISTING" = 1 ]; then echo "seed        : already in the repo (branch: $(git -C "$TARGET" branch --show-current))"; else echo "seed        : $HERE/seed (copied in, npm ci, build, first commit)"; fi
echo "isolation  : user plugins disabled via .claude/settings.local.json, no Rex on PATH, --disable-slash-commands"
echo "permissions : --permission-mode $PERM"
echo "allowed     : $TOOLS"
for s in $SESSIONS; do
  f="$HERE/sessions/$s.md"
  [ -f "$f" ] || { echo "missing session file $f" >&2; exit 1; }
  n="$(grep -c '^\[[0-9]\{1,\}\][[:space:]]*$' "$f")"
  echo "session $s : $n prompts. First: claude -p --session-id <uuid>, rest: claude -p --resume <uuid>. Then npm run build and a git commit."
done
echo "Nothing is pushed. Claude will edit files in $TARGET only."
if [ "$DRY" = 1 ]; then echo "(dry run, stopping here)"; exit 0; fi
if [ "$YES" != 1 ]; then
  printf "Proceed? [y/N] "; read -r ans; [ "$ans" = "y" ] || { echo aborted; exit 1; }
fi

# 1. seed + first commit (skipped with --existing)
cd "$TARGET"
if [ "$EXISTING" = 0 ]; then
  cp -R "$HERE/seed/." "$TARGET/"
  [ -d .git ] || git init -q
  npm ci --silent
  npm run build >/dev/null
  git add -A
  git commit -q -m "seed: static ACME pricing UI"
fi

# Isolation: the sessions must not inherit the operator's personal plugins, skills or terminal hooks.
mkdir -p .claude
python3 - <<'PY'
import json, os
user = json.load(open(os.path.expanduser("~/.claude/settings.json")))
off = {k: False for k, v in (user.get("enabledPlugins") or {}).items() if v}
json.dump({"enabledPlugins": off}, open(".claude/settings.local.json", "w"), indent=2)
PY
grep -qx '.claude/settings.local.json' .git/info/exclude 2>/dev/null || echo '.claude/settings.local.json' >> .git/info/exclude
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -vi 'rex' | paste -sd: -)"

# 2. sessions
for s in $SESSIONS; do
  echo; echo "=== session $s ==="
  tmp="$(mktemp -d)"
  split_prompts "$HERE/sessions/$s.md" "$tmp"
  sid="$(uuidgen | tr 'A-Z' 'a-z')"
  first=1
  for p in "$tmp"/*.txt; do
    echo; echo "--- prompt $(basename "$p" .txt) ---"; cat "$p"; echo "--- reply ---"
    if [ "$first" = 1 ]; then mode=(--session-id "$sid"); first=0; else mode=(--resume "$sid"); fi
    model=(); [ -n "${CLAUDE_MODEL:-}" ] && model=(--model "$CLAUDE_MODEL")
    # prompt goes in on stdin, so the variadic --allowedTools cannot swallow it
    env -u REX_SERVER -u REX_SESSION -u REX_BLOCK PATH="$CLEAN_PATH" \
      claude -p "${mode[@]}" ${model[@]+"${model[@]}"} --disable-slash-commands --permission-mode "$PERM" --allowedTools "$TOOLS" < "$p"
  done
  rm -rf "$tmp"
  echo; echo "=== build after $s ==="
  npm run build || { echo "build failed after $s, stopping (nothing committed). Inspect $TARGET" >&2; exit 1; }
  git add -A
  git diff --cached --quiet || git commit -q -m "session $s"
  echo "committed session $s (claude session id $sid)"
  if [ "${PAUSE_BETWEEN:-0}" = 1 ]; then printf "Press Enter for the next session "; read -r _; fi
done
echo; echo "done"
