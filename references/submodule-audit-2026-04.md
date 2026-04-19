# Submodule audit — 2026-04-18

**Scope:** the monorepo at `custom_portfolio/` (host of `vendor/get-anything-done`). Closes
GAD task **46-15**.

## Inventory

| Path | Pinned SHA | Branch | Last upstream commit | Remote | Live refs |
|---|---|---|---|---|---|
| `vendor/grime-time-site` | `e613e98` | `main` | 2026-04-18 | `B2Gdevs/grime_time_site` | `package.json` (15 vendor:grimetime:* scripts), `scripts/grimetime-vendor.mjs`, `packages/magicborn-cli/src/{cli,vendor-registry}.ts`, `gad-config.toml` workspace root, planning docs |
| `vendor/mb-cli-framework` | `1239e1e` | `main` | 2026-04-18 | `MagicbornStudios/mb-cli-framework` | `pnpm-workspace.yaml` (`vendor/mb-cli-framework/packages/*`), `packages/magicborn-cli/{src/cli.ts,scripts/prepare.mjs}`, `gad-config.toml` workspace root |
| `vendor/get-anything-done` | `708688f` | `main` | 2026-04-18 | `MagicbornStudios/get-anything-done` | The CLI itself: `bin/gad.cjs`, `pnpm gad:site:*` scripts, hundreds of planning, docs, and code references. Foundational. |
| `projects/magicborn` | `6544b70` | `main` | 2026-04-18 | `MagicbornStudios/gad-manuscript` | `SOUL.md`, `architecture.md`, narrative content (`projects/magicborn/narrative/**`), 100+ planning docs |
| `vendor/openclaw` | `f624b1d` | `main` | 2026-04-16 | `openclaw/openclaw` | `package.json` (5 vendor:openclaw:* scripts), `scripts/openclaw-vendor.mjs`, `docs/openclaw-docker-setup.md` |
| `vendor/claw-code` | `8c281bb` | `main` | 2026-04-18 | `B2Gdevs/claw-code` | `package.json` (8 vendor:clawcode:* scripts + `gad:claw`/`trial:claw*`), `scripts/claw-code-vendor.mjs`, `docs/claw-code-setup.md` |
| `vendor/opencode-gad` | `43f491f` | `dev` | 2026-04-16 | `B2Gdevs/opencode` | `scripts/opencode-trial*.mjs` (3 entries), `package.json` `trial:opencode*` scripts |

All seven submodules show recent (≤ 3-day-old) upstream HEADs and at least one
live reference path. None match the original task's "suspected unused" prompt
verbatim — `repub-builder` was named in the task but is **not present**
(`.gitmodules` does not list it; git history shows it was never registered as
a submodule under that path). It was likely conflated with `repo-planner`
(deleted 2026-04-12 per decision `06-01`).

## Recommendations

| Submodule | Verdict | Notes |
|---|---|---|
| `vendor/grime-time-site` | **KEEP** | Vendored Payload site, `pnpm build:books` chain, Grime-Time planning lives in `docs/grime-time/` and `apps/portfolio/content/docs/grime-time/`. Active product surface. |
| `vendor/mb-cli-framework` | **KEEP** | Pulled in via `pnpm-workspace.yaml`. Without it, `packages/magicborn-cli` cannot resolve its peers. Earlier scan confirmed 103 live references. |
| `vendor/get-anything-done` | **KEEP (foundational)** | The planning framework binary + site + skills source-of-truth. Removing this is a project-level refactor, not a submodule cleanup. |
| `projects/magicborn` | **KEEP** | Active narrative project (`gad narrative enter magicborn`); contains author IP under `projects/magicborn/narrative/`. Distinct git history. |
| `vendor/openclaw` | **KEEP** | Live `vendor:openclaw:docker:*` workflow drives the daily container. Last upstream commit is upstream security pass — wanted. |
| `vendor/claw-code` | **KEEP** | Used by `gad:claw`, `trial:claw`, `trial:claw:fullcontext` runners. Submodule is the only ingress for a private B2Gdevs fork; can't be replaced with an npm dep. |
| `vendor/opencode-gad` | **KEEP (with note)** | Tracked on `dev` branch. Last upstream commit is the rebrand work that this monorepo's `trial:opencode:gad` consumes directly. Branch tracking should remain `dev` (not `main`) — already correct in `.gitmodules`. |

**Net result: 7 KEEP, 0 INLINE, 0 DROP.** No follow-up tasks needed for the
submodules themselves.

## Adjacent findings (out of task scope, captured for follow-up)

1. **Stray un-registered git tree at `tmp/openai-codex/`.** Holds the
   `openai/codex` Rust CLI (HEAD `ea34c6e`). Confuses `git submodule status`
   (aborts with `fatal: no submodule mapping found in .gitmodules for path
   'tmp/openai-codex'`). Recommendation: delete the directory unless someone
   is actively bisecting it; if needed, register as a real submodule under
   `vendor/openai-codex` so it joins the `vendor:` script convention.
   Filed alongside this audit as a one-line follow-up note.
2. **`vendor/opencode-gad` tracks `dev`, not `main`.** Intentional per
   `.gitmodules`. Worth re-confirming with the operator at the next
   milestone whether the rebrand work has been merged to upstream `main`
   so we can flip the tracking branch and stop pulling pre-release commits.

## Verification

```
git config -f .gitmodules --get-regexp '^submodule\..*\.path$'   # 7 entries
git submodule foreach --quiet 'git rev-parse HEAD'                # 7 SHAs match table
ls tmp/openai-codex/.git                                          # confirms stray tree
```

— `cursor-default-0026` · 2026-04-18
