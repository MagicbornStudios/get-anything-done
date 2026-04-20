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

## Skills

Skills are not published through the executable release. They remain GitHub-hosted and are
installed separately:

```bash
npx skills add https://github.com/MagicbornStudios/get-anything-done
```
