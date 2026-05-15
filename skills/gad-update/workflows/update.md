<purpose>
Update GAD to the latest release via GitHub Releases. Resolve installed
version, compare against the latest release tag on
`MagicbornStudios/get-anything-done` (or `$GAD_RELEASE_REPO` for forks),
fetch release notes, confirm with the operator, then download and install
the per-OS binary plus a fresh tarball that refreshes hooks/skills/agents.

Mirrors the canonical top-level `workflows/update.md` but is co-located
with the skill so non-Claude runtimes that resolve sibling paths find it
next to `SKILL.md`. The CLI subcommand `gad update` re-implements the
same steps in pure Node (`bin/commands/update.cjs`) for runtimes without
the Skill tool.

The release lookup uses GitHub Releases API only — never `npm`. Per
decision gad-188 #1 GAD is not on public npm by design.
</purpose>

<required_reading>
- `vendor/get-anything-done/hooks/gad-check-update.js` — shares the
  `normalizeRepoSlug` / `compareVersions` / `getLatestReleaseTag`
  helpers. Same release-repo resolution path.
- `vendor/get-anything-done/dist/release/install-gad-windows.ps1` —
  handles the Windows running-exe self-replace via
  `Copy-WithLockRetry` + deferred background job.
</required_reading>

<process>

<step name="resolve_repo_and_versions">
Resolve the release repo, the latest release tag, and the locally
installed version. Repo precedence:
1. `$GAD_RELEASE_REPO` env var (forks)
2. `package.json#repository.url` of the installed framework
3. Default constant `MagicbornStudios/get-anything-done`

```bash
REPO="${GAD_RELEASE_REPO:-MagicbornStudios/get-anything-done}"

# Latest tag — gh preferred, ls-remote fallback when gh missing.
LATEST_TAG="$(gh api "repos/$REPO/releases/latest" --jq .tag_name 2>/dev/null || true)"

if [ -z "$LATEST_TAG" ]; then
  LATEST_TAG="$(git ls-remote --tags --refs "https://github.com/${REPO}.git" \
    | awk -F/ '{print $NF}' \
    | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' \
    | sort -V \
    | tail -n 1)"
fi

if [ -z "$LATEST_TAG" ]; then
  echo "Couldn't check for updates (GitHub Releases + tag list both unavailable)."
  echo "To update manually: download the release tarball from"
  echo "  https://github.com/${REPO}/releases/latest"
  echo "extract it, and run: node package/bin/install.js --claude --global"
  exit 1
fi

LATEST_VERSION="${LATEST_TAG#v}"
INSTALLED_VERSION="$(gad --version 2>/dev/null | head -n 1 | tr -d '[:space:]' || echo 0.0.0)"
INSTALLED_VERSION="${INSTALLED_VERSION#v}"

echo "Installed: ${INSTALLED_VERSION}"
echo "Latest:    ${LATEST_VERSION}"
```

If `INSTALLED_VERSION == LATEST_VERSION`, print "Already on latest" and exit.
If `INSTALLED_VERSION > LATEST_VERSION` (development build), print and exit.
</step>

<step name="show_release_notes_and_confirm">
Fetch the release notes for `LATEST_TAG` so the operator sees what's
changing before installing.

```bash
gh release view "$LATEST_TAG" --repo "$REPO" 2>/dev/null \
  || curl -fsSL "https://api.github.com/repos/${REPO}/releases/tags/${LATEST_TAG}" \
       | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{try{process.stdout.write(JSON.parse(s).body||'(no notes)')}catch{process.stdout.write('(could not parse notes)')}})"
```

Then use **AskUserQuestion** with:
- Question: `"Update GAD ${INSTALLED_VERSION} -> ${LATEST_VERSION}?"`
- Options: `"Yes, install now"`, `"No, cancel"`

Exit on cancel.
</step>

<step name="download_per_os_assets">
Download the per-platform binary and the install helper into a temp dir.
Asset names follow the convention in `release-binaries.yml`:
- Windows: `gad-v${LATEST_VERSION}-windows-x64.exe`
- macOS:   `gad-v${LATEST_VERSION}-macos-arm64`
- Linux:   `gad-v${LATEST_VERSION}-linux-x64`

```bash
TMP_DIR="$(node -e "const fs=require('fs');const os=require('os');const path=require('path');process.stdout.write(fs.mkdtempSync(path.join(os.tmpdir(),'gad-update-')));")"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    PLATFORM=windows
    ASSET="gad-v${LATEST_VERSION}-windows-x64.exe"
    gh release download "$LATEST_TAG" --repo "$REPO" \
      --pattern "$ASSET" \
      --pattern "install-gad-windows.ps1" \
      --dir "$TMP_DIR"
    ;;
  Darwin)
    PLATFORM=macos
    ASSET="gad-v${LATEST_VERSION}-macos-arm64"
    gh release download "$LATEST_TAG" --repo "$REPO" --pattern "$ASSET" --dir "$TMP_DIR"
    ;;
  Linux)
    PLATFORM=linux
    ASSET="gad-v${LATEST_VERSION}-linux-x64"
    gh release download "$LATEST_TAG" --repo "$REPO" --pattern "$ASSET" --dir "$TMP_DIR"
    ;;
  *)
    echo "Unsupported platform: $(uname -s)" >&2
    exit 1
    ;;
esac
```
</step>

<step name="install_binary">
**Windows:** the bundled `install-gad-windows.ps1` handles the
running-exe self-replace via `Copy-WithLockRetry` + a deferred
background helper that retries the copy once the parent process exits.
Install path is `%LOCALAPPDATA%\Programs\gad\bin\gad.exe`.

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass \
  -File "$TMP_DIR/install-gad-windows.ps1" \
  -Artifact "$TMP_DIR/$ASSET"
```

**macOS / Linux:** chmod and move to `$GAD_BIN_DIR` (default
`$HOME/.local/bin`). Running gad on POSIX can be overwritten while
executing — the kernel keeps the old inode mapped for the running
process; the new file gets the new inode on next launch.

```bash
INSTALL_DIR="${GAD_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"
chmod 0755 "$TMP_DIR/$ASSET"
mv -f "$TMP_DIR/$ASSET" "$INSTALL_DIR/gad"
```
</step>

<step name="refresh_tarball_assets">
The binary brings the CLI up to date; the framework's hooks, skills,
agents, and runtime command-wrappers live in the npm-style tarball
(`get-anything-done-${LATEST_VERSION}.tgz`). Download and run the
packaged installer to refresh them in-place.

```bash
gh release download "$LATEST_TAG" --repo "$REPO" \
  --pattern "get-anything-done-*.tgz" --dir "$TMP_DIR" || true

if ls "$TMP_DIR"/get-anything-done-*.tgz >/dev/null 2>&1; then
  tar -xzf "$TMP_DIR"/get-anything-done-*.tgz -C "$TMP_DIR"
  # --claude/--global is the safe default; project-local installs land
  # via the SessionStart hook detection on next runtime open.
  node "$TMP_DIR/package/bin/install.js" --claude --global
else
  echo "(no tarball asset on this release — binary-only update)"
fi
```
</step>

<step name="clear_update_check_cache">
Wipe the update-check cache so the statusline indicator clears on the
next session open.

```bash
rm -f "$HOME/.cache/gad/gad-update-check.json"
rm -f "$HOME/.cache/gsd/gsd-update-check.json"
for dir in .claude .config/opencode .opencode .gemini .codex; do
  rm -f "./$dir/cache/gad-update-check.json"
  rm -f "$HOME/$dir/cache/gad-update-check.json"
done
```
</step>

<step name="display_result">
```
GAD updated: v${INSTALLED_VERSION} -> v${LATEST_VERSION}

Restart your runtime to pick up new commands.
Full changelog: https://github.com/${REPO}/blob/main/CHANGELOG.md
```
</step>

</process>

<success_criteria>
- [ ] Repo resolved (env > package.json > default)
- [ ] Latest tag obtained via `gh api` (with `git ls-remote` fallback)
- [ ] Installed version compared; exit if up-to-date
- [ ] Release notes shown via `gh release view` before confirmation
- [ ] AskUserQuestion confirmation obtained
- [ ] Per-OS binary downloaded and installed
- [ ] Windows path uses `install-gad-windows.ps1` for self-replace
- [ ] Tarball refresh of hooks/skills/agents run when present
- [ ] Update-check cache cleared
- [ ] No use of `npm view` or `npx -y get-anything-done@latest`
</success_criteria>
