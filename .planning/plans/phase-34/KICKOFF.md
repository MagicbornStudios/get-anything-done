# Phase 34 - Executable release pipeline + GitHub-first distribution

**Phase:** 34
**Status:** kickoff complete
**Date:** 2026-04-11
**Decisions referenced:** gad-128, gad-129, gad-135, gad-136

## Goal

Ship GAD as a real downloadable executable with Windows as the primary authoritative build,
while keeping GitHub as the source of truth for both the CLI and the skills catalog.

## Scope

- Build standalone `gad` executables for Windows, macOS, and Linux with no user Node
  prerequisite.
- Keep `skills.sh` / `npx skills add` as the official skill installation path.
- Add a Windows-first install story so a user can install `gad` globally on a Windows
  machine from the built executable.
- Add release-path gating so only shipped CLI surface changes require executable rebuilds.
- Add operator-facing release scripts and GitHub workflow support for non-Windows builds.

## Non-goals

- Runtime identity and eval telemetry schema work (phase 35)
- Commit-by-commit scoring
- Public npm publication
- Full code signing / notarization automation this turn

## Definition of done

Phase 34 is done when:

1. `gad` can be built into a standalone Windows executable locally on this machine.
2. The packaged executable can run `gad --help` and `gad install all ...` without relying on
   a system Node installation.
3. A Windows install path exists that makes `gad` available globally for the current user.
4. The release scripts produce versioned artifacts for Windows, Linux, and macOS.
5. Path-gated release logic exists so non-shipping changes do not require a new executable release.
6. The docs explain the primary GitHub Release executable path, the secondary GitHub/Node path,
   and the distinct `skills.sh` install flow for skills.

## Technical direction

- Packaging: Node SEA using the current local Node `--experimental-sea-config` flow plus
  `postject`, because this machine is on Node 24 rather than the newer `--build-sea` flow.
- Runtime model: the executable is a SEA bootstrap that extracts a versioned support tree and
  then runs the extracted filesystem CLI. This preserves filesystem-based installer behavior
  without requiring Node on the user machine.
- Windows install: copy the built executable into a user bin directory and update user PATH.
- macOS/Linux builds: same SEA support-tree approach, built in GitHub Actions or locally.

## Risks to manage

- `bin/install.js` currently assumes a source tree and spawns `node`; packaged mode must route
  installer execution through the executable itself.
- Release assets must include the files the installer depends on: commands, skills, agents,
  hooks, templates, changelog, and package metadata.
- Cross-platform SEA blobs cannot share code cache or snapshots; build scripts must disable
  those features for portability.
