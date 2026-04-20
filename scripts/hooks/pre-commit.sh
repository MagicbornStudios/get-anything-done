#!/usr/bin/env sh
# pre-commit — rebuild gad.exe when working-tree src_hash differs from
# the hash embedded in the installed exe.
#
# Behavior contract:
#   - Zero changes to bin/lib/scripts/package.json → reports "skipping rebuild",
#     commit proceeds.
#   - Any such change → reports hash diff, runs build+install, then proceeds.
#   - Build failure → exits nonzero → commit is blocked.
#   - Install failure (Windows file-lock) → prints actionable message, exits nonzero.
#   - GAD_NO_PRECOMMIT_BUILD=1 → skips entirely.
#
# Installed by scripts/install-hooks.mjs into .git/hooks/pre-commit.

set -e

# Allow explicit opt-out.
if [ "${GAD_NO_PRECOMMIT_BUILD:-}" = "1" ]; then
  echo "[gad pre-commit] GAD_NO_PRECOMMIT_BUILD=1 — skipping rebuild check"
  exit 0
fi

# Locate the repo root (works from any subdirectory during a commit).
REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT="$REPO_ROOT/scripts/check-staleness.mjs"

if [ ! -f "$SCRIPT" ]; then
  echo "[gad pre-commit] check-staleness.mjs not found at $SCRIPT — skipping"
  exit 0
fi

# check-staleness exits 0 = stale (rebuild needed), 1 = fresh (skip).
if node "$SCRIPT"; then
  # Stale — rebuild.
  echo "[gad pre-commit] Running: npm run build:release"
  if ! npm --prefix "$REPO_ROOT" run build:release; then
    echo "[gad pre-commit] ERROR: build:release failed — commit blocked."
    echo "  Fix the build error and retry."
    exit 1
  fi

  echo "[gad pre-commit] Running: gad self install"
  if ! gad self install --prefix "$REPO_ROOT" 2>/dev/null; then
    # Try the node path as fallback (in case installed binary is the stale one).
    if ! node "$REPO_ROOT/bin/gad.cjs" self install 2>/dev/null; then
      echo "[gad pre-commit] ERROR: gad self install failed."
      echo "  On Windows this usually means gad.exe is locked by a running process."
      echo "  Close any running gad processes and retry the commit."
      exit 1
    fi
  fi

  echo "[gad pre-commit] Rebuild + install complete."
else
  # Fresh — nothing to do.
  : # message already printed by check-staleness.mjs
fi

exit 0
