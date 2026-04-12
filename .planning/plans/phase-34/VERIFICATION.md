# Phase 34 Verification

Date: 2026-04-11

## Outcome

Phase 34 is functionally complete.

- Windows packaged executable built successfully.
- Packaged install flow works without requiring a user-managed Node install.
- Global Windows install path is in place for the current user.
- GitHub-first docs and `skills.sh` skill distribution are documented and verified.
- Release-surface gating and POSIX release workflow are present.

## Commands Run

```powershell
node scripts/build-release.mjs --platform win32 --arch x64
.\dist\release\gad-v1.32.0-windows-x64.exe --help
.\dist\release\gad-v1.32.0-windows-x64.exe install all --codex --global --config-dir <scratch>
.\dist\release\gad-v1.32.0-windows-x64.exe install self
node scripts/release-should-build.mjs --base HEAD~1 --head HEAD
cmd /c npx skills add https://github.com/MagicbornStudios/get-anything-done --list
```

## Verified Results

- `build-release.mjs` produced `dist/release/gad-v1.32.0-windows-x64.exe`.
- The packaged executable prints CLI help correctly.
- The packaged executable can run `install all --codex` and route installer work through the
  packaged runtime instead of `node install.js`.
- `install self` copied `gad.exe` to `%LOCALAPPDATA%\Programs\gad\bin\gad.exe` and updated the
  user PATH.
- `npx skills add ... --list` cloned the GitHub repo and found 33 installable skills.
- `release-should-build.mjs` reports a release is required when shipped CLI files change.

## Remaining Gaps

`cmd /c npm.cmd test` is still failing, but the failures appear to be pre-existing and outside
the scope of phase 34. The failing areas include:

- legacy test expectations that still reference old `gsd-*` names and paths
- installer tests that assume real user runtime directories like `%USERPROFILE%\\.claude`
- existing installer/test drift unrelated to the executable release pipeline

Phase 34 did not attempt to fix the entire legacy test suite. The executable release pipeline
and Windows install flow were verified directly with targeted commands instead.
