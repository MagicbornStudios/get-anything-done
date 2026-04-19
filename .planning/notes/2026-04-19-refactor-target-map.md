# 2026-04-19 refactor target map

Purpose: identify low-collision refactor lanes for shrinking GAD source files while Cursor is actively working on `bin/gad.cjs`.

## Current conflict state

- In-flight: `bin/gad.cjs` has a large local diff, roughly 1,450 LOC removed / 29 LOC added.
- In-flight: new command modules exist under `bin/commands/`: `eval-preview.cjs`, `eval-suite.cjs`, `generate.cjs`, `generation.cjs`, `migrate-schema.cjs`, `shortcuts.cjs`, `try.cjs`.
- Shared planning change: `.planning/STATE.xml` is locally modified. Avoid hand-editing shared planning XML; use CLI-mediated updates.
- Lane warning: `references/agent-lanes.md` assigns CLI/runtime to Codex and denies `bin/gad.cjs` to Cursor, but Cursor is currently editing it. Coordinate before any other agent touches `bin/gad.cjs` or the new command files.

## High-size source targets

Generated/preserved artifacts, `node_modules`, `tmp`, and `.claude/worktrees` were excluded from this scan.

| Rank | File | LOC | Notes |
|---:|---|---:|---|
| 1 | `bin/install.js` | 6801 | Best large refactor target outside current `gad.cjs` work. Mixes argument parsing, runtime conversion, TOML parsing, installer copy logic, uninstall, release download, and onboarding. |
| 2 | `site/scripts/build-site-data.mjs` | 4088 | Site data pipeline combines scanning, zipping, markdown/frontmatter parsing, workflow analytics, generated TS writers, planning graph output, and validation. |
| 3 | `bin/commands/runtime.cjs` | 1189 | Command file is already modularized but still mixes substrate detection, launch specs, artifact annotation, context resolution, prompt assembly, and command registration. |
| 4 | `lib/eval-data-access.cjs` | 1111 | Good extraction candidate: project/species/generation/recipe operations can be separated without touching CLI entrypoint. |
| 5 | `site/components/devid/DevPanel.tsx` | 1055 | High churn and UI-heavy. Refactor only if site/UI lane is coordinated with Cursor/Gemini. |
| 6 | `lib/graph-extractor.cjs` | 1011 | Parser, graph builder, query engine, HTML renderer, cache/staleness logic in one file. Good split target with existing tests. |
| 7 | `lib/docs-compiler.cjs` | 770 | XML-to-MDX, MDX-to-XML, diffing, and hydration are separable. Medium risk due planning docs behavior. |
| 8 | `lib/subagent-dispatch.cjs` | 698 | Prompt construction, task selection, dispatch records, run listing, and completion updates are separable. Existing tests available. |

## Recommended first lanes

1. `bin/install.js` into `lib/install/*` modules.
   - Low overlap with current `bin/gad.cjs` extraction.
   - Highest LOC reduction.
   - Existing relevant tests: `runtime-converters`, `copilot-install`, `consumer-init-install`, `agent-install-validation`, `installer-feature-flags`, `multi-runtime-select`.

2. `lib/graph-extractor.cjs` into parser/query/render/cache modules.
   - Cleanest behavior-preserving extraction because it has `tests/graph-extractor.test.cjs`.
   - Avoids CLI entrypoint and site UI conflicts.

3. `lib/eval-data-access.cjs` split by domain.
   - Good robustness target: isolate filesystem path resolution and JSON write semantics.
   - Coordinate with any active eval/project-market work before editing.

4. `site/scripts/build-site-data.mjs` split into `site/scripts/build-site-data/*`.
   - Large payoff, but high site churn. Use only when Cursor/Gemini are not touching `site/**`.

## Avoid until Cursor finishes

- `bin/gad.cjs`
- `bin/commands/eval-preview.cjs`
- `bin/commands/eval-suite.cjs`
- `bin/commands/generate.cjs`
- `bin/commands/generation.cjs`
- `bin/commands/migrate-schema.cjs`
- `bin/commands/shortcuts.cjs`
- `bin/commands/try.cjs`

These are likely part of the same extraction and should be treated as one in-flight change set.

## Refactor protocol

- Lock behavior with targeted tests before each extraction when coverage is missing.
- Move one concern at a time and keep the old public API stable.
- Prefer `module.exports` compatibility shims from the old file while moving implementation into smaller modules.
- Run targeted tests after each slice, then full `npm test` before claiming the lane complete.
- Do not edit shared planning XML by hand.
