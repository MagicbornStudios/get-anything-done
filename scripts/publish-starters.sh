#!/usr/bin/env bash
# Batch-create GitHub repos for each starter under starters/.
# Run this after `gh auth login` and review.
#
# Usage:
#   bash scripts/publish-starters.sh [--dry-run]
#
# Each starter becomes a public repo under MagicbornStudios/ with:
#   - An initial commit containing the template files + README
#   - A description matching the README's first line
#   - Public visibility
#
# Prerequisites:
#   - gh CLI installed and authenticated (`gh auth status`)
#   - MagicbornStudios org access

set -euo pipefail

ORG="MagicbornStudios"
DRY_RUN="${1:-}"
STARTERS_DIR="$(cd "$(dirname "$0")/../starters" && pwd)"

if ! command -v gh &>/dev/null; then
  echo "ERROR: gh CLI not found. Install it first:"
  echo "  winget install GitHub.cli"
  echo "  # or: brew install gh"
  echo "Then: gh auth login"
  exit 1
fi

echo "Publishing starters from: $STARTERS_DIR"
echo "Organization: $ORG"
echo ""

for starter_dir in "$STARTERS_DIR"/*/; do
  name="$(basename "$starter_dir")"
  readme="$starter_dir/README.md"

  if [ ! -f "$readme" ]; then
    echo "  SKIP $name — no README.md"
    continue
  fi

  # Extract description from first blockquote line
  description=$(grep "^>" "$readme" | head -1 | sed 's/^> //')

  echo "  $name"
  echo "    desc: $description"

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "    [dry-run] would create $ORG/$name"
    continue
  fi

  # Create a temp directory for the repo
  tmp_dir=$(mktemp -d)
  cp -r "$starter_dir"/* "$tmp_dir/" 2>/dev/null || true
  cp -r "$starter_dir"/.planning "$tmp_dir/" 2>/dev/null || true

  cd "$tmp_dir"
  git init -q
  git add -A
  git commit -q -m "Initial commit — starter template for $name

Part of the Get Anything Done eval framework.
See https://get-anything-done.vercel.app for demos + research.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

  # Create the repo (or skip if it already exists)
  if gh repo view "$ORG/$name" &>/dev/null 2>&1; then
    echo "    repo exists — pushing update"
    git remote add origin "https://github.com/$ORG/$name.git"
    git push -u origin main --force
  else
    gh repo create "$ORG/$name" \
      --public \
      --description "$description" \
      --source . \
      --push
    echo "    ✓ created https://github.com/$ORG/$name"
  fi

  cd - >/dev/null
  rm -rf "$tmp_dir"
  echo ""
done

echo "Done. Repos are at https://github.com/$ORG?tab=repositories"
