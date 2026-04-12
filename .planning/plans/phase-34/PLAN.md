# Phase 34 - Executable release pipeline + GitHub-first distribution · PLAN

**Phase:** 34
**Status:** executed 2026-04-11
**Decisions referenced:** gad-128, gad-129, gad-135, gad-136

---

## Goal

Replace the npm-first CLI release story with a GitHub-first executable release pipeline that
ships a usable Windows build now and supports Linux/macOS artifact generation with the same
runtime model.

## Definition of done

Phase 34 is done when:

1. The repo can build a versioned `gad` executable for the current Windows machine.
2. The executable bootstraps a packaged support tree and can run the existing CLI against it.
3. `gad install all` works from the executable without a system Node prerequisite.
4. A Windows install flow makes the executable available globally for the current user.
5. A path-gated release detector exists and is wired into release docs/workflows.
6. The repo contains release automation for Windows-local authoritative builds and GitHub
   Actions builds for Linux/macOS.
7. Install docs clearly distinguish:
   - CLI executable install via GitHub Releases
   - optional GitHub/Node path for users who already have Node
   - skills install via `skills.sh` / `npx skills add`

## Task breakdown

### Milestone A - packaging target and runtime bootstrap (34-01)

**34-01** - Formalize and implement the executable packaging target.

- Build a release support tree from shipped CLI assets:
  - `dist/gad.cjs`
  - `bin/install.js`
  - `commands/`
  - `.agents/skills/`
  - `agents/`
  - `hooks/dist/`
  - `templates/`
  - `CHANGELOG.md`
  - `package.json`
- Add a SEA bootstrap script that:
  - detects packaged mode via `node:sea`
  - extracts support assets to a versioned support directory
  - dispatches either the extracted CLI bundle or the extracted installer entry
- Update `gad install all` so packaged builds route installer execution through the executable,
  not `node install.js`.
- Output artifact naming:
  - `gad-v<version>-windows-<arch>.exe`
  - `gad-v<version>-linux-<arch>`
  - `gad-v<version>-macos-<arch>`

**Verify**

- `node scripts/build-release.mjs --platform win32 --arch x64`
- built executable runs `--help`
- built executable can execute `install all --codex --global --config-dir <scratch>`

### Milestone B - Windows global install and operator flow (34-02, 34-03)

**34-02** - Ship the official GitHub-first install flow.

- Rewrite install/release messaging in:
  - `README.md`
  - `docs/quick-start.md`
  - `docs/eval-guide.md`
  - any stale CLI help text that still assumes public npm
- Add CLI help text that points packaged users at GitHub Releases and Node users at the GitHub repo.
- Add release operator docs covering:
  - build prerequisites
  - Windows local authoritative build
  - optional GitHub/Node path

**Verify**

- docs consistently describe GitHub Releases as primary path
- no stale `npx get-anything-done@latest` primary-path messaging remains in user-facing install docs

**34-03** - Make skills distribution distinct and explicit.

- Verify/document `npx skills add https://github.com/MagicbornStudios/get-anything-done`
  or equivalent GitHub repo install path.
- Update docs so skills installation is never confused with CLI installation.

**Verify**

- install docs have a dedicated skills section with exact commands

### Milestone C - release gating and release automation (34-04, 34-05)

**34-04** - Implement release-surface gating.

- Add a source-of-truth release surface definition for:
  - `bin/**`
  - `lib/**`
  - `hooks/**`
  - `commands/**`
  - `.agents/skills/**`
  - `agents/**`
  - `templates/**`
  - `scripts/build-*`
  - release scripts/workflows
  - `package.json`
- Add a CLI/script that reports whether a diff requires a new executable build.

**Verify**

- docs-only change returns "no release required"
- CLI/runtime file change returns "release required"

**34-05** - Implement the release pipeline.

- Windows local authoritative release script:
  - build release support tree
  - generate SEA blob
  - inject blob into copied node executable
  - emit versioned artifact
  - emit Windows install script/package
- GitHub Actions workflow for Linux/macOS matrix builds on shipped-surface changes.
- Release docs for uploading/updating GitHub Release assets after CLI changes.

**Verify**

- local Windows build completes
- GitHub Actions workflow validates
- release docs match actual scripts

## Verification commands

```sh
cd vendor/get-anything-done
node scripts/build-cli.mjs
node scripts/build-release.mjs --platform win32 --arch x64
.\dist\release\gad-v<version>-windows-x64.exe --help
.\dist\release\gad-v<version>-windows-x64.exe install all --codex --global --config-dir <scratch>
pwsh -ExecutionPolicy Bypass -File scripts/install-gad-windows.ps1 -Artifact .\dist\release\gad-v<version>-windows-x64.exe
node scripts/release-should-build.mjs --base HEAD~1 --head HEAD
```

## Execution notes

- Built `dist/release/gad-v1.32.0-windows-x64.exe` locally on Windows.
- Verified the packaged executable runs `--help` and routes `install all --codex` without a
  system Node prerequisite.
- Verified `npx skills add https://github.com/MagicbornStudios/get-anything-done --list`
  discovers installable skills from the GitHub repo.
- Installed `gad.exe` globally for the current user at
  `%LOCALAPPDATA%\Programs\gad\bin\gad.exe`.
- Full `npm test` is still red due to pre-existing legacy installer / GSD drift outside this
  phase; see `VERIFICATION.md`.

## Commits

One atomic commit per task slice. Update `TASK-REGISTRY.xml` when a task is complete and
`STATE.xml` after each milestone boundary.
