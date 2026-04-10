#!/usr/bin/env bash
# Clone-based eval runner — workaround for anthropics/claude-code#46279.
#
# Instead of using worktree isolation (where hooks don't fire), this script:
# 1. Clones the starter repo to a temp directory
# 2. Sets up .claude/settings.json with the GAD trace hook
# 3. Sets GAD_EVAL_TRACE_DIR for per-run trace capture
# 4. Outputs the agent spawn configuration
#
# Usage:
#   bash scripts/eval-clone-run.sh <project-name>
#
# Example:
#   bash scripts/eval-clone-run.sh escape-the-dungeon-bare
#
# After running this script, the orchestrating agent should:
# 1. Read the AGENT_CONFIG.json from the clone directory
# 2. Spawn a Claude Code Agent in that directory (NOT with isolation: "worktree")
# 3. The hooks will fire because .claude/settings.json exists in the clone
# 4. After completion: copy trace + build artifacts back to evals/<project>/<version>/

set -euo pipefail

PROJECT="${1:?Usage: eval-clone-run.sh <project-name>}"
GAD_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_HANDLER="$GAD_ROOT/bin/gad-trace-hook.cjs"

# Verify hook handler exists
if [ ! -f "$HOOK_HANDLER" ]; then
  echo "ERROR: Hook handler not found at $HOOK_HANDLER"
  exit 1
fi

# Determine next version number
EVAL_DIR="$GAD_ROOT/evals/$PROJECT"
if [ ! -d "$EVAL_DIR" ]; then
  echo "ERROR: Eval project '$PROJECT' not found at $EVAL_DIR"
  exit 1
fi

NEXT_VERSION=$(ls "$EVAL_DIR" | grep '^v[0-9]' | sed 's/v//' | sort -n | tail -1)
NEXT_VERSION=$((${NEXT_VERSION:-0} + 1))
VERSION="v$NEXT_VERSION"

# Create run directory
RUN_DIR="$EVAL_DIR/$VERSION"
mkdir -p "$RUN_DIR"

# Clone the starter repo to a temp directory
CLONE_DIR=$(mktemp -d)
STARTER_DIR="$GAD_ROOT/starters/$PROJECT"

if [ -d "$STARTER_DIR" ]; then
  echo "Copying from starters/$PROJECT..."
  cp -r "$STARTER_DIR/"* "$CLONE_DIR/" 2>/dev/null || true
  [ -d "$STARTER_DIR/.planning" ] && cp -r "$STARTER_DIR/.planning" "$CLONE_DIR/"
else
  echo "No starter found. Copying from eval template..."
  TEMPLATE_DIR="$EVAL_DIR/template"
  cp -r "$TEMPLATE_DIR/"* "$CLONE_DIR/" 2>/dev/null || true
  [ -d "$TEMPLATE_DIR/.planning" ] && cp -r "$TEMPLATE_DIR/.planning" "$CLONE_DIR/"
fi

# Initialize git in the clone (needed for Claude Code to work)
cd "$CLONE_DIR"
git init -q
git add -A
git commit -q -m "Initial eval setup for $PROJECT $VERSION"

# Set up .claude/settings.json with the GAD trace hook
mkdir -p .claude
HOOK_PATH_ESCAPED=$(echo "$HOOK_HANDLER" | sed 's/\\/\\\\/g')

cat > .claude/settings.json << SETTINGS_EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOOK_PATH_ESCAPED\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOOK_PATH_ESCAPED\""
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF

# Create .planning directory for trace output (the hook handler looks for this)
mkdir -p .planning

# Set the trace directory via a .env-like file the hook can read
# Since we can't set env vars for the hook process, we use a marker file
echo "$RUN_DIR" > .planning/.trace-target-dir

echo ""
echo "=== Eval Clone Ready ==="
echo "  Project: $PROJECT"
echo "  Version: $VERSION"
echo "  Clone:   $CLONE_DIR"
echo "  Run dir: $RUN_DIR"
echo "  Hooks:   .claude/settings.json configured"
echo "  Trace:   .planning/.trace-events.jsonl (in clone)"
echo ""
echo "The orchestrating agent should:"
echo "  1. Spawn a Claude Code Agent in: $CLONE_DIR"
echo "     (use Bash to cd there, NOT isolation: 'worktree')"
echo "  2. The agent builds the game following AGENTS.md + REQUIREMENTS.xml"
echo "  3. Hooks fire on every tool call → .planning/.trace-events.jsonl"
echo "  4. After completion: copy artifacts back:"
echo "     cp -r $CLONE_DIR/game/src $RUN_DIR/run/"
echo "     cp -r $CLONE_DIR/game/dist/* site/public/playable/$PROJECT/$VERSION/"
echo "     cp $CLONE_DIR/.planning/.trace-events.jsonl $RUN_DIR/"
echo ""

# Write AGENT_CONFIG.json for the orchestrator to read
cat > "$RUN_DIR/AGENT_CONFIG.json" << CONFIG_EOF
{
  "project": "$PROJECT",
  "version": "$VERSION",
  "cloneDir": "$CLONE_DIR",
  "runDir": "$RUN_DIR",
  "hooksConfigured": true,
  "traceEventsFile": "$CLONE_DIR/.planning/.trace-events.jsonl",
  "postSteps": [
    "Copy source: cp -r $CLONE_DIR/game/src $RUN_DIR/run/",
    "Copy build: cp -r $CLONE_DIR/game/dist/* site/public/playable/$PROJECT/$VERSION/",
    "Copy trace: cp $CLONE_DIR/.planning/.trace-events.jsonl $RUN_DIR/",
    "Create TRACE.json with timing + tokens + trace events",
    "Regenerate site: cd site && node scripts/build-site-data.mjs",
    "Commit + push"
  ]
}
CONFIG_EOF

echo "AGENT_CONFIG.json written to: $RUN_DIR/AGENT_CONFIG.json"
