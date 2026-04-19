# 44-28 spine — first cut shipped 2026-04-18

**Umbrella:** task 44-28 (`status="planned"` until follow-ups land)
**Decision:** gad-188
**Reference:** `references/installer-feature-flags.md`

## What landed

| Sub-task | Status | Surface |
|---|---|---|
| 44-32 — `bin/install.js` flags | `partial` (a/b/d done; e deferred) | `--site`, `--planning`, `--node`, `--from-release`, `--target` |
| 44-33 — site packaging | `partial` (a/d/e/f done; b/c done first-cut, c follow-up = .exe) | `output:"standalone"` in `site/next.config.mjs`; `site/scripts/launcher.cjs`; `site/scripts/pack-site-release.cjs`; root `pnpm pack:site` |
| 44-34 — portable Node | `stub` | `--node` flag scaffolds `.planning/.node/` + `.planning/.cmd/` with `README.txt` placeholder; actual download deferred until release pipeline ships node zip |

## Consumer first-run today (works)

```bash
gad.exe --planning --site --from-release v1.35.0
node .planning/site/launcher.cjs
# → http://127.0.0.1:5560/  in the default browser
```

This is the "operator with no Node, no GAD repo, just the installer"
path that decision gad-188 demanded. The launcher is currently a Node
script; consumers still need a system Node to boot it. The Bun-compiled
launcher.exe (44-33c follow-up) closes that loop.

## Verified

- `node bin/install.js --help` lists the new flag block under
  "Feature flags (44-28 spine — independent of runtime install)"
- `node bin/install.js --planning --target <tmp>` writes 6 canonical
  XML ledgers
- `node bin/install.js --site --target <tmp>` warns cleanly when no
  bundle exists, dropping a stub site dir + helpful pointer
- `node bin/install.js --node --target <tmp>` reserves
  `.planning/.node/README.txt` and prints the deferred-work note
- `tests/consumer-init-install.test.cjs` — 11/11 pass
- `GAD_TEST_MODE=1 node -e "require('./bin/install.js')"` — 52 module
  exports intact (no breakage of the test surface)

## Deferred (follow-ups)

| Follow-up | Why | Tracked under |
|---|---|---|
| Bun `--compile` of `launcher.cjs` → `launcher.exe` | Needs Bun cross-compile in CI; first cut ships Node shim | 44-33c follow-up |
| Actual portable Node zip download | Release pipeline must publish `node-<platform>-<arch>.zip` | 44-34 follow-up (likely bundled with 44-31) |
| Interactive feature picker reshape (`{site, skills, planning, node}` then runtime) | Non-blocking; UX-only; flag path covers scripted/CI consumer | 44-32e |
| Pre-publish check: `dist/release/site-v<tag>.zip` exists before tag | Mirror the npm-tarball regression pattern from 2026-04-18 | release-binaries.yml extension |
| `tests/installer-feature-flags.test.cjs` end-to-end | Smokes captured manually in this note; codify next session | follow-up |

## Why 44-28 stays `planned`

Umbrella tasks remain `planned` until every sub-task is either `done`
or explicitly cancelled. Three sub-tasks shipped partial; one stayed
stub. Keeping 44-28 open avoids the false signal that the spine is
fully delivered. Close it when 44-32e + 44-33c (Bun .exe) + 44-34
(real node zip) all land.
