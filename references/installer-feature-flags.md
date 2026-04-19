# Installer feature flags — `bin/install.js` 44-28 spine first cut

**Status:** shipped 2026-04-18 (tasks 44-32, 44-33, 44-34 — partial).
**Decision:** gad-188 (UMBRELLA, see `.planning/DECISIONS.xml`).
**Anchor task:** 44-28 (umbrella).

The classic install path (`gad install all --<runtime>`) hasn't changed.
This doc is for the **consumer-facing first-run** that decision gad-188
introduced: a Windows operator who downloads `gad.exe`, drops it in a
folder, and wants the planning scaffold + the local site running with
no Node prerequisite.

The four flags are independent of runtime selection. You can install just
the planning scaffold + site without touching any coding-agent runtime.
Mixing is allowed: `--planning --site --claude --global` runs the feature
install first, then the runtime install proceeds normally.

## Flag reference

| Flag | What it does |
|---|---|
| `--planning` | Scaffold `<target>/.planning/` with the canonical XML ledgers (STATE, ROADMAP, TASK-REGISTRY, DECISIONS, REQUIREMENTS, ERRORS-AND-ATTEMPTS). Idempotent: refuses to overwrite a non-empty `.planning/`. Re-states templates from `bin/gad.cjs §INIT_XML_TEMPLATES` so the installer doesn't depend on a `gad` binary being present. |
| `--site` | Copy a self-contained planning site into `<target>/.planning/site/`. Prefers a packed release bundle at `<source>/dist/release/site-v<tag>/`; falls back to the live standalone build at `<source>/site/.next/standalone/`. Drops the launcher (`launcher.cjs`) alongside. |
| `--node` | Reserve `<target>/.planning/.node/` for the portable Node bootstrap. Currently a stub — actual download lands once the release pipeline ships a `node-<platform>-<arch>.zip` asset (44-34 follow-up). |
| `--from-release <tag\|url>` | Download a release zip (`zipball_url` for tag, raw url accepted) and source files from there instead of the local checkout. Required when the consumer only has the installer and not the repo. |
| `--target <path>` | Override the consumer target directory. Defaults to `process.cwd()`. |

Safe-zone contract: the feature install only writes inside `<target>/.planning/`.
Nothing touches the home directory or system PATH.

## Consumer first-run examples

```bash
# Pure consumer flow — no Node, no GAD repo, just the executable
gad.exe --planning --site --from-release v1.35.0
# → scaffolds .planning/<6 XML files>
# → drops .planning/site/ from the v1.35.0 release bundle
# → launches via: node .planning/site/launcher.cjs

# With portable Node reservation (stub today; real bootstrap when 44-34 lands)
gad.exe --planning --site --node --from-release v1.35.0

# Full first-run: planning + site + Claude runtime
gad.exe --planning --site --claude --global

# Just the planning scaffold (no site, no runtime)
gad.exe --planning
```

## Site bundle production

The site bundle is built once per release and uploaded as a release asset.

```bash
# In the GAD repo
pnpm --filter @get-anything-done/site install   # if site/ deps not installed
pnpm build:site                                  # next build with output:standalone
pnpm pack:site                                   # → dist/release/site-v<version>.zip
```

`pack:site` (`site/scripts/pack-site-release.cjs`) stages
`.next/standalone/` + `.next/static/` + `public/` + `launcher.cjs` into
`dist/release/site-v<version>/`, then zips it. The release-pipeline upload
step picks up the zip from `dist/release/`.

## Site launcher (`site/scripts/launcher.cjs`)

Boot model: `node launcher.cjs` from the release dir spawns
`node server.js` against a free port in 5560–5599, waits for the port to
bind, then opens the system browser at `http://127.0.0.1:<port>/`.

Env knobs:

| Env | Default | Notes |
|---|---|---|
| `GAD_SITE_PORT` | auto in 5560–5599 | Pin a port |
| `GAD_SITE_HOST` | `127.0.0.1` | Bind host |
| `GAD_SITE_NO_BROWSER` | (unset) | Set to `1` to skip auto-open |
| `GAD_PLANNING_DIR` | `<release>/../..` | Override which `.planning/` the site reads from at request time |

Ctrl+C in the terminal kills the spawned server cleanly. Server crash
propagates its exit code through the launcher.

## Deferred follow-ups

The first cut intentionally stops short of a few things that need
release-pipeline cooperation:

| Follow-up | Owner task | Why deferred |
|---|---|---|
| Bun `--compile` of `launcher.cjs` to `launcher.exe` | 44-33c follow-up | Needs Bun cross-compile in the release CI; the Node shim ships in v1.35+ as a no-Bun-required stop-gap |
| Actual portable Node download | 44-34 follow-up | Release pipeline must publish a `node-<platform>-<arch>.zip` asset (likely as part of the 44-31 release-pipeline task) |
| Interactive feature picker reshape (prompt for {site, skills, planning, node} before runtime) | 44-32e | Non-blocking — current flag-only path covers the scripted/CI consumer cleanly. UX work tracked separately. |
| Pre-commit verification that `dist/release/site-v<tag>.zip` exists before publishing a release | release-binaries.yml extension | Mirror the npm-tarball regression test pattern from 2026-04-18 |

## Rollback / uninstall

The feature install only touches `<target>/.planning/`. To uninstall:

```bash
rm -rf <target>/.planning/site
rm -rf <target>/.planning/.node
rm -rf <target>/.planning/.cmd
# or wipe the whole scaffold:
rm -rf <target>/.planning
```

The runtime-install path is unchanged — `--uninstall` still works for
removing GAD from a coding-agent runtime config dir.

## Tests

End-to-end smokes (manual, captured in 2026-04-18 session log):

```bash
node bin/install.js --planning --target /tmp/gad-installer-smoke
node bin/install.js --site     --target /tmp/gad-installer-smoke2  # warns when no bundle
node bin/install.js --node     --target /tmp/gad-installer-smoke3
node bin/install.js --help                                          # new flag block visible
GAD_TEST_MODE=1 node -e "require('./bin/install.js')"               # 52 module exports intact
node --test tests/consumer-init-install.test.cjs                    # 11/11 pass
```

A dedicated `tests/installer-feature-flags.test.cjs` is a follow-up.
