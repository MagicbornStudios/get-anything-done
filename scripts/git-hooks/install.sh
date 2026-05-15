#!/usr/bin/env sh
# scripts/git-hooks/install.sh
#
# Install the repo-hygiene pre-push hook into .git/hooks/.
# One-liner: `sh scripts/git-hooks/install.sh`
#
# Why not just `core.hooksPath`? That would force the same path on every clone
# globally, which conflicts with other tooling (husky, lefthook, etc.). A
# tracked-file-plus-installer pattern is the most portable.
#
# This script:
#   1. Resolves the repo's $GIT_DIR (handles submodules + worktrees).
#   2. Copies (or symlinks if supported) scripts/git-hooks/pre-push into
#      $GIT_DIR/hooks/pre-push and marks it executable.
#   3. Backs up any existing hook to pre-push.bak-<timestamp> first.
#
# Exit codes: 0 on success, 1 on failure.

set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null || (cd "$HERE/../.." && pwd))
GIT_DIR=$(git -C "$REPO_ROOT" rev-parse --git-dir)
# Detect already-absolute paths on both POSIX (/foo) and Windows (C:/foo).
case "$GIT_DIR" in
  /*|[A-Za-z]:/*|[A-Za-z]:\\*) ABS_GIT_DIR="$GIT_DIR" ;;
  *)  ABS_GIT_DIR="$REPO_ROOT/$GIT_DIR" ;;
esac

SRC="$HERE/pre-push"
DST="$ABS_GIT_DIR/hooks/pre-push"

if [ ! -f "$SRC" ]; then
  echo "install.sh: source hook not found at $SRC" >&2
  exit 1
fi

mkdir -p "$ABS_GIT_DIR/hooks"

if [ -e "$DST" ] && [ ! -L "$DST" ]; then
  TS=$(date +%s)
  mv "$DST" "$DST.bak-$TS"
  echo "install.sh: backed up existing hook to pre-push.bak-$TS"
fi

# Prefer symlink (so edits to scripts/git-hooks/pre-push are picked up live
# and the dispatcher can locate pre-push.cjs as a sibling via readlink).
# Fall back to writing a tiny wrapper that points back to $SRC by absolute
# path when symlinks aren't supported (some Windows setups).
if ln -sf "$SRC" "$DST" 2>/dev/null; then
  echo "install.sh: symlinked $DST -> $SRC"
else
  printf '#!/usr/bin/env sh\nexec "%s" "$@"\n' "$SRC" > "$DST"
  chmod +x "$DST"
  echo "install.sh: wrapper $DST -> $SRC"
fi

chmod +x "$DST" 2>/dev/null || true
echo "install.sh: pre-push hook installed."
