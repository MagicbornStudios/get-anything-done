# 44-28 spine — second cut + 44-34 cancellation

**Date:** 2026-04-19
**Trigger:** operator: "close 44-34 as cancelled and keep working on 44-32/44-33"
**Predecessor note:** `2026-04-18-44-28-spine-first-cut.md`

## What changed

### 44-34 cancelled

The portable-Node bootstrap (download a pinned `node-<platform>-<arch>.zip`
from our release assets, drop it at `<target>/.planning/.node/`, write a
shim at `<target>/.planning/.cmd/gad.cmd`) was abandoned.

**Why:** 44-33c was already heading toward a Bun `--compile`'d
`launcher.exe` that gives consumers a no-Node-required path to run the
planning site. Shipping our own pinned Node distro for the *sole* purpose
of running the site duplicates that work, makes us own a Node-distribution
channel we don't otherwise want, and adds ~30 MB per platform to every
release for a problem one Bun binary already solves.

**Cleanup landed in same session:**

- `bin/install.js`: removed `installPortableNodeStub()` and
  `.planning/.node` + `.planning/.cmd` scaffold logic. `--node` flag
  now prints a deprecation notice and is a no-op.
- `--node` kept parseable for one release window so scripted callers
  from 1.35.x don't break. `tests/installer-feature-flags.test.cjs`
  asserts the deprecation notice fires and the stub directories are
  *not* created.
- Help block demoted `--node` to a dim/deprecated row.
- `references/installer-feature-flags.md`: rewritten with a "Cancelled
  (44-34)" section explaining the rationale.
- `TASK-REGISTRY.xml`: 44-34 → `status="cancelled"` with full resolution.

Removal of the `--node` flag entirely is tracked as the
`44-32-cleanup` follow-up (one release after the deprecation window).

### 44-32 follow-up: interactive feature picker (44-32e) — landed

`bin/install.js` invoked with no flags now drops into the new
`promptFeatures` picker:

```
What would you like to install?

  1) Planning scaffold  (.planning/ XML ledgers — STATE, ROADMAP, TASK-REGISTRY, ...)
  2) Planning site      (self-contained Next.js dashboard at .planning/site/)
  3) Coding-agent skills (install GAD into Claude/Codex/Cursor/etc — picks runtime next)
  4) All of the above

  Select multiple: 1,2 or 1 3 — empty/Enter accepts default

  Choice [4]:
```

Multi-select with `1,2` or `1 2`. If skills (3) is picked, the picker
chains into the existing `promptRuntime` → `promptLocation` flow after
running the feature install; otherwise it exits cleanly after the
feature install. If nothing is selected (e.g. typed `0`), prints
"Nothing selected — exiting" and bails.

`runFeatureInstall(features)` accepts an optional override object so the
interactive path can pass picked features directly without re-parsing
argv.

### 44-32 follow-up: dedicated tests — landed

`tests/installer-feature-flags.test.cjs` (7 tests, 5 suites):

| Suite | Test |
|---|---|
| `--help surface` | Lists feature flags under the 44-28 spine block |
| `--planning` | Scaffolds 6 canonical XML ledgers |
| `--planning` | Refuses to overwrite a non-empty `.planning/` (idempotent) |
| `--planning` | Derives projectid from target folder basename |
| `--site` (no bundle) | Prints warning + recovery hint when no packed bundle exists |
| `--node` (deprecated) | Prints deprecation notice and writes nothing under `.planning/` |
| Combined `--planning --site` | Runs both feature installs in one shot, prints `Feature install complete` banner |

All 7 pass. `tests/consumer-init-install.test.cjs` 11/11 still pass —
runtime-install path is unaffected by the feature-flag work.

### 44-33 follow-up: Bun `--compile` of launcher.exe (44-33c-bun) — landed

`site/scripts/launcher.cjs` refactored to dual-mode:

1. **Node mode (default):** unchanged — spawn `node server.js` as a
   child process, probe for the listening port, open the system browser.
2. **Bun-compiled mode:** when invoked from a Bun `--compile`'d
   `launcher.exe` (detected via `typeof Bun !== "undefined"`),
   `process.execPath` is the launcher itself, so spawning won't work.
   Instead the launcher sets `PORT`/`HOSTNAME` env and
   `require('./server.js')` in-process — Bun's Node-compat layer runs
   Next standalone `server.js` without modification.

Override the auto-detect with `GAD_LAUNCHER_FORCE_SPAWN=1` to force the
Node-mode subprocess path even from a Bun-compiled binary (requires a
sibling `node` on PATH).

`site/scripts/pack-site-release.cjs` extended with `compileBunLauncher()`:
detects `bun` on PATH; runs `bun build --compile --target=<host>` (or
per-target list via `GAD_LAUNCHER_TARGETS=bun-windows-x64,bun-linux-x64,bun-darwin-x64`)
to produce `launcher-<platform>-<arch>.exe` alongside `launcher.cjs` in
the staged release dir; failure non-fatal so the Node-shim always ships.

**Smoke-verified:** `bun build --compile site/scripts/launcher.cjs`
produces a 111 MB self-contained .exe (full Bun runtime embedded). When
run without a sibling `server.js`, prints the correct error and bails:

```
[gad-launcher] missing server.js at <cwd>/server.js
[gad-launcher] re-pack the release with `pnpm pack:site` from the framework root
```

The 111 MB cost is unavoidable (full Bun runtime per binary). Consumers
with Node already on PATH should prefer the lightweight `launcher.cjs`.

### 44-33 follow-up: pre-publish guard for site zip — landed

`scripts/publish-release.mjs` extended with `ensureSiteZipIfRequired()`:
fails the `gh release upload` step if `site-v<tag>.zip` is missing from
`dist/release/`. Same regression-guard pattern as `ensureReleaseTarball`
(npm tarball, added in 44-38). Opt-out via `GAD_SKIP_SITE_ZIP_GUARD=1`
for CLI-only patch releases that intentionally don't ship the site.

Test coverage added in `tests/release-deprecation.test.cjs`:

- `site-v<version>.zip` recognized as a release artifact
- `ensureSiteZipIfRequired` throws when missing
- Respects `GAD_SKIP_SITE_ZIP_GUARD=1`

5/5 tests in the suite pass.

## Test totals

```
node --test tests/installer-feature-flags.test.cjs   # 7/7 pass
node --test tests/release-deprecation.test.cjs       # 5/5 pass (added 1 new test)
node --test tests/consumer-init-install.test.cjs     # 11/11 pass
                                                     # ────────────
                                                     # 23/23 pass
```

## Remaining 44-28 follow-ups

| Task | What |
|---|---|
| 44-33c-ci | Cross-compile launcher.exe in CI for windows-x64, linux-x64, darwin-x64 (currently only host platform unless `GAD_LAUNCHER_TARGETS` is set) |
| 44-33c-verify | Live runtime test of launcher.exe against a real Next standalone build (needs `pnpm build:site` first; ship-then-verify acceptable since `GAD_LAUNCHER_FORCE_SPAWN=1` is the escape hatch) |
| 44-32-cleanup | Remove `--node` flag entirely (one release after deprecation notice) |

`44-28` umbrella stays `planned` until the CI cross-compile and live
verify land — those are the last two pieces between "spine works in dev"
and "consumer first-run is fully production-ready".

## Files touched

```
M  bin/install.js                                    # --node deprecated, promptFeatures added
M  site/scripts/launcher.cjs                         # dual-mode (Node + Bun-compiled)
M  site/scripts/pack-site-release.cjs                # bun --compile integration
M  scripts/publish-release.mjs                       # ensureSiteZipIfRequired guard
M  references/installer-feature-flags.md             # rewritten for post-44-34 surface
M  tests/release-deprecation.test.cjs                # +1 test for site-zip guard
A  tests/installer-feature-flags.test.cjs            # 7 tests
A  .planning/notes/2026-04-19-44-28-spine-second-cut.md  # this file
M  .planning/TASK-REGISTRY.xml                       # 44-32, 44-33, 44-34 resolutions
M  .planning/STATE.xml                               # next-action + last-updated
```
