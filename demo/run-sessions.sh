#!/usr/bin/env bash
# Replays the scripted ACME sessions against a real headless Claude Code, one prompt at a time.
#
# usage: ./run-sessions.sh [--dry-run] [--yes] <empty-demo-repo-dir>
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

DRY=0; YES=0; TARGET=""
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --yes) YES=1 ;;
    -*) echo "unknown flag $a" >&2; exit 2 ;;
    *) TARGET="$a" ;;
  esac
done
[ -n "$TARGET" ] || { echo "usage: $0 [--dry-run] [--yes] <empty-demo-repo-dir>" >&2; exit 2; }
[ -d "$TARGET" ] || { echo "refusing: $TARGET is not a directory" >&2; exit 1; }
TARGET="$(cd "$TARGET" && pwd)"

# Safety check: empty, or only a .git entry.
extra="$(ls -A "$TARGET" | grep -vx '.git' || true)"
if [ -n "$extra" ]; then
  echo "refusing: $TARGET is not empty. Found:" >&2
  echo "$extra" | head -5 | sed 's/^/  /' >&2
  exit 1
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
echo "seed        : $HERE/seed (copied in, npm ci, build, first commit)"
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

# 1. seed + first commit
cp -R "$HERE/seed/." "$TARGET/"
cd "$TARGET"
[ -d .git ] || git init -q
npm ci --silent
npm run build >/dev/null
git add -A
git commit -q -m "seed: static ACME pricing UI"

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
    claude -p "${mode[@]}" ${model[@]+"${model[@]}"} --permission-mode "$PERM" --allowedTools "$TOOLS" < "$p"
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
