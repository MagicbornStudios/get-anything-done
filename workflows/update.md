<purpose>
Check for GAD updates via GitHub Releases, display changelog for versions between installed and latest, obtain user confirmation, and execute clean installation with cache clearing.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="get_installed_version">
Detect whether GAD is installed locally or globally by checking both locations and validating install integrity.

First, derive `PREFERRED_RUNTIME` from the invoking prompt's `execution_context` path:
- Path contains `/.codex/` -> `codex`
- Path contains `/.gemini/` -> `gemini`
- Path contains `/.config/opencode/` or `/.opencode/` -> `opencode`
- Otherwise -> `claude`

Use `PREFERRED_RUNTIME` as the first runtime checked so `/gad:update` targets the runtime that invoked it.

```bash
# Runtime candidates: "<runtime>:<config-dir>" stored as an array.
# Using an array instead of a space-separated string ensures correct
# iteration in both bash and zsh (zsh does not word-split unquoted
# variables by default). Fixes #1173.
RUNTIME_DIRS=( "claude:.claude" "opencode:.config/opencode" "opencode:.opencode" "gemini:.gemini" "codex:.codex" )

# PREFERRED_RUNTIME should be set from execution_context before running this block.
# If not set, infer from runtime env vars; fallback to claude.
if [ -z "$PREFERRED_RUNTIME" ]; then
  if [ -n "$CODEX_HOME" ]; then
    PREFERRED_RUNTIME="codex"
  elif [ -n "$GEMINI_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="gemini"
  elif [ -n "$OPENCODE_CONFIG_DIR" ] || [ -n "$OPENCODE_CONFIG" ]; then
    PREFERRED_RUNTIME="opencode"
  elif [ -n "$CLAUDE_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="claude"
  else
    PREFERRED_RUNTIME="claude"
  fi
fi

# Reorder entries so preferred runtime is checked first.
ORDERED_RUNTIME_DIRS=()
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" = "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" != "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done

# Check local first (takes priority only if valid and distinct from global)
LOCAL_VERSION_FILE="" LOCAL_MARKER_FILE="" LOCAL_DIR="" LOCAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "./$dir/get-anything-done/VERSION" ] || [ -f "./$dir/workflows/update.md" ]; then
    LOCAL_RUNTIME="$runtime"
    LOCAL_VERSION_FILE="./$dir/get-anything-done/VERSION"
    LOCAL_MARKER_FILE="./$dir/workflows/update.md"
    LOCAL_DIR="$(cd "./$dir" 2>/dev/null && pwd)"
    break
  fi
done

GLOBAL_VERSION_FILE="" GLOBAL_MARKER_FILE="" GLOBAL_DIR="" GLOBAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "$HOME/$dir/get-anything-done/VERSION" ] || [ -f "$HOME/$dir/workflows/update.md" ]; then
    GLOBAL_RUNTIME="$runtime"
    GLOBAL_VERSION_FILE="$HOME/$dir/get-anything-done/VERSION"
    GLOBAL_MARKER_FILE="$HOME/$dir/workflows/update.md"
    GLOBAL_DIR="$(cd "$HOME/$dir" 2>/dev/null && pwd)"
    break
  fi
done

# Only treat as LOCAL if the resolved paths differ (prevents misdetection when CWD=$HOME)
IS_LOCAL=false
if [ -n "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  if [ -z "$GLOBAL_DIR" ] || [ "$LOCAL_DIR" != "$GLOBAL_DIR" ]; then
    IS_LOCAL=true
  fi
fi

if [ "$IS_LOCAL" = true ]; then
  INSTALLED_VERSION="$(cat "$LOCAL_VERSION_FILE")"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  INSTALLED_VERSION="$(cat "$GLOBAL_VERSION_FILE")"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
elif [ -n "$LOCAL_RUNTIME" ] && [ -f "$LOCAL_MARKER_FILE" ]; then
  # Runtime detected but VERSION missing/corrupt: treat as unknown version, keep runtime target
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_RUNTIME" ] && [ -f "$GLOBAL_MARKER_FILE" ]; then
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
else
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="UNKNOWN"
  TARGET_RUNTIME="claude"
fi

echo "$INSTALLED_VERSION"
echo "$INSTALL_SCOPE"
echo "$TARGET_RUNTIME"
```

Parse output:
- Line 1 = installed version (`0.0.0` means unknown version)
- Line 2 = install scope (`LOCAL`, `GLOBAL`, or `UNKNOWN`)
- Line 3 = target runtime (`claude`, `opencode`, `gemini`, or `codex`)
- If scope is `UNKNOWN`, proceed to install step using `--claude --global` fallback.

If multiple runtime installs are detected and the invoking runtime cannot be determined from execution_context, ask the user which runtime to update before running install.

**If VERSION file missing:**
```
## GAD Update

**Installed version:** Unknown

Your installation doesn't include version tracking.

Running fresh install...
```

Proceed to install step (treat as version 0.0.0 for comparison).
</step>

<step name="check_latest_version">
Check GitHub Releases for the latest version. Default repo is the installed package's `repository` field; override with `GAD_RELEASE_REPO=<owner>/<repo>` for forks.

Preferred lookup:

```bash
REPO="${GAD_RELEASE_REPO:-MagicbornStudios/get-anything-done}"
gh api "repos/$REPO/releases/latest" --jq .tag_name 2>/dev/null
```

Fallback when `gh` is missing or unauthenticated:

```bash
node -e "const { execFileSync } = require('child_process'); const repo = process.argv[1]; const out = execFileSync('git', ['ls-remote', '--tags', '--refs', `https://github.com/${repo}.git`], { encoding: 'utf8' }).trim(); const tags = out.split(/\r?\n/).map((line) => (line.split(/\s+/)[1] || '').replace(/^refs\/tags\//, '')).filter((tag) => /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); process.stdout.write(tags[tags.length - 1] || '');" "$REPO"
```

Set `LATEST_TAG` from the first successful command and compare on the normalized version string:

```bash
LATEST_VERSION="${LATEST_TAG#v}"
```

**If both checks fail:**
```
Couldn't check for updates (GitHub Releases unavailable).

To update manually: download `get-anything-done-<version>.tgz` from the latest GitHub release, extract it, and run `node package/bin/install.js --claude --global`.
```

Exit.
</step>

<step name="compare_versions">
Compare installed vs latest:

**If installed == latest:**
```
## GAD Update

**Installed:** X.Y.Z
**Latest:** X.Y.Z

You're already on the latest version.
```

Exit.

**If installed > latest:**
```
## GAD Update

**Installed:** X.Y.Z
**Latest:** A.B.C

You're ahead of the latest release (development version?).
```

Exit.
</step>

<step name="show_changes_and_confirm">
**If update available**, fetch and show what's new BEFORE updating:

1. Fetch changelog from GitHub raw URL
2. Extract entries between installed and latest versions
3. Display preview and ask for confirmation:

```
## GAD Update Available

**Installed:** 1.5.10
**Latest:** 1.5.15

### What's New
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20

### Added
- Feature X

## [1.5.14] - 2026-01-18

### Fixed
- Bug fix Y

────────────────────────────────────────────────────────────

⚠️  **Note:** The installer performs a clean install of GAD folders:
- generated runtime command wrappers will be wiped and replaced
- `get-anything-done/` will be wiped and replaced
- `agents/gad-*` files will be replaced

(Paths are relative to the detected runtime config location:
global runtime config: the agent's global config directory, such as Claude, OpenCode, Gemini, or Codex
local: `./.claude/`, `./.config/opencode/`, `./.opencode/`, `./.gemini/`, or `./.codex/`)

Your custom files in other locations are preserved:
- Custom runtime commands outside GAD-managed paths ✓
- Custom agents not prefixed with `gad-` ✓
- Custom hooks ✓
- Your CLAUDE.md files ✓

If you've modified any GAD files directly, they'll be automatically backed up to `gad-local-patches/` and can be reapplied with `/gad:reapply-patches` after the update.
```

Use AskUserQuestion:
- Question: "Proceed with update?"
- Options:
  - "Yes, update now"
  - "No, cancel"

**If user cancels:** Exit.
</step>

<step name="run_update">
Run the update using the install type detected in step 1:

Build runtime flag from step 1:
```bash
RUNTIME_FLAG="--$TARGET_RUNTIME"
```

Create a temp directory, download the tarball asset from GitHub Releases, extract it, then run the packaged installer:

```bash
REPO="${GAD_RELEASE_REPO:-MagicbornStudios/get-anything-done}"
TMP_DIR="$(node -e "const fs=require('fs');const os=require('os');const path=require('path');process.stdout.write(fs.mkdtempSync(path.join(os.tmpdir(),'gad-update-')));")"
gh release download "$LATEST_TAG" --repo "$REPO" --pattern 'get-anything-done-*.tgz' --dir "$TMP_DIR"
tar -xzf "$TMP_DIR"/get-anything-done-*.tgz -C "$TMP_DIR"
```

**If LOCAL install:**
```bash
node "$TMP_DIR/package/bin/install.js" "$RUNTIME_FLAG" --local
```

**If GLOBAL install:**
```bash
node "$TMP_DIR/package/bin/install.js" "$RUNTIME_FLAG" --global
```

**If UNKNOWN install:**
```bash
node "$TMP_DIR/package/bin/install.js" --claude --global
```

Capture output. If install fails, show error and exit.

Clear the update cache so statusline indicator disappears:

```bash
rm -f "$HOME/.cache/gad/gad-update-check.json"
rm -f "$HOME/.cache/gsd/gsd-update-check.json"
for dir in .claude .config/opencode .opencode .gemini .codex; do
  rm -f "./$dir/cache/gad-update-check.json"
  rm -f "$HOME/$dir/cache/gad-update-check.json"
  rm -f "./$dir/cache/gsd-update-check.json"
  rm -f "$HOME/$dir/cache/gsd-update-check.json"
done
```

The SessionStart hook (`gad-check-update.js`) now writes to the shared `~/.cache/gad/gad-update-check.json` cache file, but the legacy runtime-specific paths should still be cleared for backward compatibility.
</step>

<step name="display_result">
Format completion message (changelog was already shown in confirmation step):

```
╔═══════════════════════════════════════════════════════════╗
║  GAD Updated: v1.5.10 → v1.5.15                           ║
╚═══════════════════════════════════════════════════════════╝

⚠️  Restart your runtime to pick up the new commands.

[View full changelog](https://github.com/MagicbornStudios/get-anything-done/blob/main/CHANGELOG.md)
```
</step>


<step name="check_local_patches">
After update completes, check if the installer detected and backed up any locally modified files:

Check for gad-local-patches/backup-meta.json in the config directory.

**If patches found:**

```
Local patches were backed up before the update.
Run /gad:reapply-patches to merge your modifications into the new version.
```

**If no patches:** Continue normally.
</step>
</process>

<success_criteria>
- [ ] Installed version read correctly
- [ ] Latest version checked via npm
- [ ] Update skipped if already current
- [ ] Changelog fetched and displayed BEFORE update
- [ ] Clean install warning shown
- [ ] User confirmation obtained
- [ ] Update executed successfully
- [ ] Restart reminder shown
</success_criteria>
