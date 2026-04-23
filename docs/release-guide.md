# GAD Release Guide

GAD is distributed from GitHub Releases, with Windows as the authoritative local build.

## When to release

Only release when the shipped CLI surface changes. Check that first:

```bash
node scripts/release-should-build.mjs --base HEAD~1 --head HEAD
```

## Build the Windows artifact locally

```bash
npm install
npm run build:release
```

Output lands in `dist/release/`.

Windows artifact:

```text
dist/release/gad-v<version>-windows-<arch>.exe
```

The build also writes:

- `install-gad-windows.ps1`
- `INSTALL.txt`

## Validate before publishing

```powershell
.\dist\release\gad-v<version>-windows-x64.exe --help
.\dist\release\gad-v<version>-windows-x64.exe install all --codex --global --config-dir $env:TEMP\gad-release-smoke
```

## Publish to GitHub Releases

Use GitHub CLI from the repo:

```bash
node scripts/publish-release.mjs --tag v<version>
```

If the release does not exist, the script creates it. If it already exists, the script uploads
and overwrites the matching assets.

## Linux and macOS

`.github/workflows/release-posix.yml` builds Linux and macOS artifacts when the shipped CLI
surface changes on `main`, or when the workflow is dispatched manually.

Those builds use the same packaged runtime model:

- standalone executable
- no user Node prerequisite
- support tree extracted on first run

## Local rebuild after source changes

Pre-commit auto-rebuild was retired 2026-04-23 because it deadlocked during
worker sessions. Fresh installs no longer create a git hook. After changing
source that ships in the executable, run this manually before publishing or
validating an installed CLI:

```bash
gad self build && gad self install
```

`gad self install` now uses a Windows-safe rename-swap pattern for both
`gad.exe` and `gad-tui.exe`: if the destination binary already exists, the
installer renames it to `<name>.old-<timestamp>`, copies the new binary into
place, and then best-effort deletes `.old-*` files older than 7 days. This
lets a running process finish on its original file handle while new shells pick
up the fresh binary immediately.

Manual verification on Windows:

```powershell
gad tui
# keep the TUI running in terminal 1

# terminal 2
gad self install
Get-ChildItem $env:LOCALAPPDATA\Programs\gad\bin\gad*.old-*
gad version
```

Expected result:

- `gad self install` succeeds without the old lock error.
- The already-running TUI keeps running.
- A fresh `gad version` uses the newly installed binary.
- `%LOCALAPPDATA%\Programs\gad\bin\` contains the new executable plus at least
  one `.old-<timestamp>` file until cleanup ages it out.

## Skills

Skills are not published through the executable release. They remain GitHub-hosted and are
installed separately:

```bash
npx skills add https://github.com/MagicbornStudios/get-anything-done
```
