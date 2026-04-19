# Installer feature flags — `bin/install.js` 44-28 spine

**Status:** shipped 2026-04-18, follow-ups landed 2026-04-19 (tasks 44-32, 44-33).
**Decision:** gad-188 (UMBRELLA, see `.planning/DECISIONS.xml`).
**Anchor task:** 44-28 (umbrella).

The classic install path (`gad install all --<runtime>`) hasn't changed.
This doc is for the **consumer-facing first-run** that decision gad-188
introduced: a Windows operator who downloads `gad.exe`, drops it in a
folder, and wants the planning scaffold + the local site running with no
Node prerequisite.

The flags below are independent of runtime selection. You can install just
the planning scaffold + site without touching any coding-agent runtime.
Mixing is allowed: `--planning --site --claude --global` runs the feature
install first, then the runtime install proceeds normally.

## Flag reference

| Flag | What it does |
|---|---|
| `--planning` | Scaffold `<target>/.planning/` with the canonical XML ledgers (STATE, ROADMAP, TASK-REGISTRY, DECISIONS, REQUIREMENTS, ERRORS-AND-ATTEMPTS). Idempotent: refuses to overwrite a non-empty `.planning/`. Re-states templates from `bin/gad.cjs §INIT_XML_TEMPLATES` so the installer doesn't depend on a `gad` binary being present. |
| `--site` | Copy a self-contained planning site into `<target>/.planning/site/`. Prefers a packed release bundle at `<source>/dist/release/site-v<tag>/`; falls back to the live standalone build at `<source>/site/.next/standalone/`. Drops the launcher (`launcher.cjs` always; `launcher-<platform>-<arch>.exe` when packed with Bun) alongside. |
| `--from-release <tag\|url>` | Download a release zip (`zipball_url` for tag, raw url accepted) and source files from there instead of the local checkout. Required when the consumer only has the installer and not the repo. |
| `--target <path>` | Override the consumer target directory. Defaults to `process.cwd()`. |
| `--node` | **Deprecated, no-op.** Prints a one-line notice. Kept for one release window so scripted callers from 1.35.x don't break. |

Safe-zone contract: the feature install only writes inside `<target>/.planning/`.
Nothing touches the home directory or system PATH.

## Cancelled (44-34)

The portable-Node bootstrap (download a pinned `node-<platform>-<arch>.zip`
from our release assets and drop it at `<target>/.planning/.node/`) was
**cancelled 2026-04-19**. The Bun-compiled `launcher.exe` from 44-33c does
the same job — gives consumers a no-Node path to run the planning site —
without us owning a Node-distribution channel.

`--node` flag remains parseable for one release window, prints a deprecation
notice, and writes nothing under `.planning/`. It will be removed entirely
in a follow-up release.

## Consumer first-run examples

```bash
# Pure consumer flow — no Node, no GAD repo, just the executable
gad.exe --planning --site --from-release v1.36.0
# → scaffolds .planning/<6 XML files>
# → drops .planning/site/ from the v1.36.0 release bundle
# → launches via: .planning/site/launcher-windows-x64.exe (no Node required)
# → or:           node .planning/site/launcher.cjs (Node-shim path)

# Full first-run: planning + site + Claude runtime
gad.exe --planning --site --claude --global

# Just the planning scaffold (no site, no runtime)
gad.exe --planning
```

## Interactive picker (no flags)

`gad.exe` invoked without any flags drops into the interactive picker
(44-32e). The picker asks "What would you like to install?":

1. Planning scaffold (`.planning/` XML ledgers)
2. Planning site (self-contained Next.js dashboard)
3. Coding-agent skills (route into the existing runtime picker)
4. All of the above

Multi-select with `1,2` or `1 2`. Pressing Enter accepts the default (4).
If skills is selected, the picker chains into the existing
`promptRuntime` → `promptLocation` flow after running the feature install;
otherwise it exits cleanly.

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
`dist/release/site-v<version>/`. When Bun is on `PATH`, it also compiles
`launcher.cjs` into `launcher-<platform>-<arch>.exe` (host platform by
default; set `GAD_LAUNCHER_TARGETS=bun-windows-x64,bun-linux-x64,bun-darwin-x64`
to cross-compile). Then it zips the staged dir.

The release-pipeline upload step picks up the zip from `dist/release/`.
`scripts/publish-release.mjs` enforces a hard guard
(`ensureSiteZipIfRequired`) that fails the publish if `site-v<tag>.zip` is
missing — same regression-guard pattern as the npm-tarball
(`ensureReleaseTarball`) added in 44-38. Set `GAD_SKIP_SITE_ZIP_GUARD=1`
on a CLI-only patch release that intentionally doesn't ship the site.

## Site launcher (`site/scripts/launcher.cjs`)

Two runtime modes, picked automatically:

1. **Node mode (default):** `node launcher.cjs` from the release dir
   spawns `node server.js` against a free port in 5560–5599, waits for
   the port to bind, then opens the system browser at
   `http://127.0.0.1:<port>/`.
2. **Bun-compiled mode:** when invoked from the Bun `--compile`'d
   `launcher.exe`, there's no sibling Node to spawn. The launcher sets
   `PORT`/`HOSTNAME` env and `require('./server.js')` in-process — Bun's
   Node-compat layer runs Next standalone server.js without modification.

Override the auto-detect with `GAD_LAUNCHER_FORCE_SPAWN=1` to force the
Node-mode subprocess path even from a Bun-compiled binary (requires a
sibling `node` on `PATH`).

Env knobs:

| Env | Default | Notes |
|---|---|---|
| `GAD_SITE_PORT` | auto in 5560–5599 | Pin a port |
| `GAD_SITE_HOST` | `127.0.0.1` | Bind host |
| `GAD_SITE_NO_BROWSER` | (unset) | Set to `1` to skip auto-open |
| `GAD_PLANNING_DIR` | `<release>/../..` | Override which `.planning/` the site reads from at request time |
| `GAD_LAUNCHER_FORCE_SPAWN` | (unset) | Force Node-mode subprocess from a Bun-compiled binary |

Ctrl+C in the terminal kills the spawned server cleanly. Server crash
propagates its exit code through the launcher.

The Bun-compiled `launcher.exe` is ~110 MB (full Bun runtime embedded).
Consumers with Node already on `PATH` should prefer the lightweight
`launcher.cjs`.

## Deferred follow-ups

| Follow-up | Owner task | Why deferred |
|---|---|---|
| Cross-compile launcher.exe in CI for all three platforms | 44-33c-ci | Currently only the host platform is built unless `GAD_LAUNCHER_TARGETS` is set. Wire into release-binaries.yml. |
| Live runtime test of `launcher.exe` against a real Next standalone build | 44-33c-verify | Requires `pnpm build:site` first; ship-then-verify acceptable since `GAD_LAUNCHER_FORCE_SPAWN=1` is the escape hatch if Bun-mode breaks. |
| Remove `--node` flag entirely (one release after deprecation notice) | 44-32-cleanup | Soft-deprecation window for scripted callers from 1.35.x. |

## Rollback / uninstall

The feature install only touches `<target>/.planning/`. To uninstall:

```bash
rm -rf <target>/.planning/site
# or wipe the whole scaffold:
rm -rf <target>/.planning
```

The runtime-install path is unchanged — `--uninstall` still works for
removing GAD from a coding-agent runtime config dir.

## Tests

| File | Coverage |
|---|---|
| `tests/installer-feature-flags.test.cjs` | `--help` lists the spine block; `--planning` scaffolds 6 XML ledgers; `--planning` is idempotent; projectid derivation from target basename; `--site` warns gracefully when no bundle present; `--node` deprecated no-op; combined `--planning --site` end-to-end. |
| `tests/release-deprecation.test.cjs` | `site-v<version>.zip` recognized as a release artifact; `ensureSiteZipIfRequired` throws when missing and respects `GAD_SKIP_SITE_ZIP_GUARD=1`. |
| `tests/consumer-init-install.test.cjs` | Pre-existing 11/11 (regression guard for the runtime-install path — feature flags must not break the classic install). |

Manual smokes (capture in session logs when re-running):

```bash
node bin/install.js --help                                          # new flag block visible
node bin/install.js --planning --target /tmp/gad-installer-smoke
node bin/install.js --site     --target /tmp/gad-installer-smoke2   # warns when no bundle
node bin/install.js --node     --target /tmp/gad-installer-smoke3   # deprecation notice
GAD_TEST_MODE=1 node -e "require('./bin/install.js')"               # 52 module exports intact
node --test tests/installer-feature-flags.test.cjs                  # 7/7 pass
node --test tests/release-deprecation.test.cjs                      # 5/5 pass
node --test tests/consumer-init-install.test.cjs                    # 11/11 pass
```
