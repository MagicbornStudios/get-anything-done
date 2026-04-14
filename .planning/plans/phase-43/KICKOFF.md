# Phase 43 - Domain rename + project/species schema unification

**Phase:** 43
**Status:** kickoff complete
**Date:** 2026-04-13
**Decisions referenced:** gad-38, gad-160 through gad-179, plus phase 43 D-01 through D-28 captured in 43-CONTEXT.md

## Goal

Two changes shipped together so the codebase is never left half-renamed:

1. **Schema unification** — Today's sibling eval directories collapse into parent **project** dirs containing **species** subdirectories. For multi-variant projects (escape-the-dungeon, gad-explainer-video) the final shape is exactly three species: `gad`, `bare`, `emergent`. Single-variant projects (cli-efficiency, reader-workspace, gad-skill-creator-eval, etc.) get their schema migrated to project + species fields but no directory moves.

2. **Domain rename** — A coherent vocabulary lands across gad.json schema, build-site-data, every site display string, the gad CLI + help text, AGENTS.md, and any new prose written from this phase forward:
   - `round` → **evolution** (a project-level event triggered by requirement changes)
   - `vN` (per species) → **generation**
   - skill manifest baked into a species → **DNA**
   - bundle a generation produces → **spawn**
   - parent container of species → **project**
   - No new word for the cross-species cohort — "the v4 generations" plural is enough.

## Scope

In:
- Delete unused conditions: `escape-the-dungeon-gad-emergent`, `escape-the-dungeon-planning-only`, all `etd-brownfield-*`, all `etd-{babylonjs,phaser,pixijs,threejs}`
- Drop the greenfield/brownfield `eval_mode` field entirely from schema, code, and copy
- Physical merge of `escape-the-dungeon` (the gad species) + `-bare` + `-emergent` into one parent dir with `species/` subdirs
- Same merge for `gad-explainer-video` family
- Schema migration for all remaining single-variant projects to the new project/species shape
- Rewrite of `site/scripts/build-site-data.mjs` `scanEvalProjects` + `scanProducedArtifacts` to walk the new layout
- Rename of preserved build dirs under `apps/portfolio/public/evals/` to match new species/generation paths
- Update `tests/eval-preservation.test.cjs` to expect the new paths
- Update gad CLI help text and any command that takes a project ID to accept the new shape
- Update AGENTS.md, the Loop docs, and any planning prose written FROM this phase forward
- New transitional note in PROJECT.md / ROADMAP.xml about the vocabulary change
- Phase 43 also stubs `cardImage`, `tagline`, `heroImage` fields in the new project schema for phase 44 to populate
- Roadmap title for phase 44.5 changes from "Brood Editor" to "Species Editor" + reserves `/project-editor` route name

Out:
- Anything that touches phase 44/44.5/45 implementation (new editor surfaces, marketplace UI, rebrand)
- Backfilling new vocab into closed phase prose (D-15: going-forward only)
- Any new product capabilities

## Decisions referenced

- gad-38 — eval preservation contract (paths must remain working under the new scheme)
- gad-176 / gad-179 — context framework as first-class axis parallel to workflow
- gad-178 — skills determine workflows
- gad-167 / gad-171 — proto-skill is permanent, bulk+checkpoint pattern
- D-01 through D-28 — see 43-CONTEXT.md

## Definition of done

Phase 43 is done when:

1. `evals/` contains exactly one `escape-the-dungeon/` dir with `species/{gad,bare,emergent}/` subdirs, each containing the generations from the old sibling dirs.
2. `evals/gad-explainer-video/` follows the same shape.
3. None of the deleted conditions remain on disk: `gad-emergent`, `planning-only`, brownfield, tech-stack variants.
4. `apps/portfolio/public/evals/` matches the new species/generation paths.
5. `tests/eval-preservation.test.cjs` passes against the new paths.
6. `npm run build` (or the equivalent site build) succeeds end-to-end with the new schema.
7. `gad snapshot --projectid get-anything-done` runs cleanly.
8. The gad.json files use the new schema (`species` field, no `eval_mode`, `cardImage`/`tagline`/`heroImage` stubs present).
9. Site display strings use the new vocabulary across the GAD landing site (`vendor/get-anything-done/site/`).
10. AGENTS.md and the Loop docs use the new vocabulary.
11. ROADMAP.xml phase 44.5 title is updated to "Species Editor" and references "Brood" are removed from current planning prose (closed phase prose untouched).
12. PROJECT.md (or ROADMAP.xml header) carries the single transitional note about the rename.
</content>
</invoke>