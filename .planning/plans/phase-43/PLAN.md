# Phase 43 - Domain rename + project/species schema unification · PLAN

**Phase:** 43
**Status:** in progress
**Decisions referenced:** gad-38, gad-160 through gad-179, phase 43 D-01 through D-28

---

## Goal

See KICKOFF.md. Two atomic moves: schema unification (parent project + species subdirs) + domain rename (round → evolution, vN → generation, DNA, spawn). Single coherent shipping arc — code/disk/tests update together so the system is never half-renamed in a working state.

## Definition of done

See KICKOFF.md "Definition of done" section.

## Task breakdown

### Milestone A — Disk migration foundation (43-01, 43-02)

**43-01** — Delete the conditions we are dropping entirely.

- `git rm -r evals/escape-the-dungeon-gad-emergent/`
- `git rm -r evals/escape-the-dungeon-planning-only/`
- `git rm -r evals/etd-brownfield-bare/ evals/etd-brownfield-gad/ evals/etd-brownfield-emergent/`
- `git rm -r evals/etd-babylonjs/ evals/etd-phaser/ evals/etd-pixijs/ evals/etd-threejs/`
- Delete corresponding preserved builds under `apps/portfolio/public/evals/` if any exist for these projects.
- Single commit with message documenting which conditions are being dropped and why (D-20, D-21, D-22, D-23).

**Verify**

- `ls evals/` no longer shows any of the deleted dirs
- `ls apps/portfolio/public/evals/` no longer shows preserved builds for deleted projects
- `git status` is clean after commit

**43-02** — Physical merge of the escape-the-dungeon family into one parent dir.

- Move `evals/escape-the-dungeon` → `evals/_etd_tmp_gad_` (intermediate, can't move dir into itself)
- Move `evals/escape-the-dungeon-bare` → `evals/_etd_tmp_bare_`
- Move `evals/escape-the-dungeon-emergent` → `evals/_etd_tmp_emergent_`
- Create `evals/escape-the-dungeon/species/`
- Move `_etd_tmp_gad_` → `evals/escape-the-dungeon/species/gad`
- Move `_etd_tmp_bare_` → `evals/escape-the-dungeon/species/bare`
- Move `_etd_tmp_emergent_` → `evals/escape-the-dungeon/species/emergent`
- Same operations for `gad-explainer-video` family.
- Single commit. Use `git mv` so history is preserved.

**Verify**

- `ls evals/escape-the-dungeon/species/` shows `gad`, `bare`, `emergent`
- `ls evals/escape-the-dungeon/species/gad/v12/` exists (proves history-preserving move)
- `git log --follow evals/escape-the-dungeon/species/gad/v1/` shows pre-migration history
- No top-level `evals/escape-the-dungeon-bare/` or `-emergent/` remains

### Milestone B — Schema migration (43-03, 43-04)

**43-03** — Define the new gad.json schema and write the per-species `species.json` files.

- New parent-level `evals/<project>/project.json` (or repurpose the gad species' gad.json) with fields:
  - `name`, `slug`, `description`, `domain`, `tech_stack` (canonical default), `tagline` (stub), `cardImage` (stub null), `heroImage` (stub null)
- Each `evals/<project>/species/<species>/species.json` carries:
  - `species` (gad | bare | emergent | …), `context_framework`, `tech_stack` (override), `dna` (workflow + skill manifest summary), `description`, `inherits_from` if any
- For `escape-the-dungeon`: write `project.json` once; write three `species.json` files. Drop the legacy gad.json files (or rename them to species.json with the new field set).
- For `gad-explainer-video`: same.
- For all other single-variant evals (cli-efficiency, reader-workspace, etc.): wrap their existing gad.json into a single-species shape — write a `project.json` at the top + a `species/<framework>/species.json` (or, simpler: keep them flat for now with a `species: <name>` field at the top of gad.json indicating they are degenerate one-species projects). Pick whichever shape requires the least adapter code in build-site-data.
- Drop `eval_mode` field everywhere (D-22).
- Drop `compare_to` arrays referencing deleted projects.

**Verify**

- Every `evals/*/project.json` parses as JSON
- Every `evals/*/species/*/species.json` parses as JSON
- `eval_mode` no longer appears in any gad.json/project.json/species.json: `grep -r "eval_mode" evals/` returns nothing

**43-04** — Migrate preserved build artifact paths under `apps/portfolio/public/evals/`.

- For each surviving project, move `apps/portfolio/public/evals/<old-flat-name>/` to `apps/portfolio/public/evals/<project>/<species>/`
- Specifically:
  - `escape-the-dungeon/` → `escape-the-dungeon/gad/`
  - `escape-the-dungeon-bare/` → `escape-the-dungeon/bare/`
  - `escape-the-dungeon-emergent/` → `escape-the-dungeon/emergent/`
- Each species dir contains the existing `vN/` generations.
- `git mv` to preserve history.

**Verify**

- `ls apps/portfolio/public/evals/escape-the-dungeon/` shows `gad/ bare/ emergent/`
- `ls apps/portfolio/public/evals/escape-the-dungeon/bare/v3/` still has the build assets

### Milestone C — Code: data extractor (43-05, 43-06)

**43-05** — Rewrite `scanEvalProjects()` and `scanProducedArtifacts()` in `site/scripts/build-site-data.mjs` to walk the new layout.

- `scanEvalProjects` walks `evals/<project>/project.json`, then `evals/<project>/species/<species>/species.json`, emitting one row per species with `{project, species, contextFramework, techStack, dna, …}`.
- Single-variant projects with no `species/` subdir are read as one species named after the framework.
- Replace the hardcoded `["escape-the-dungeon", "escape-the-dungeon-bare", "escape-the-dungeon-emergent"]` list (line 583) with a derived list from the new walker.
- Update the `scanProducedArtifacts` walker to descend into `species/<species>/v<N>/` instead of `<project>/v<N>/`.
- Update the keys (currently `${project}/${version}`) to `${project}/${species}/${version}`.
- All downstream consumers of those keys must be updated in lockstep.

**Verify**

- `node site/scripts/build-site-data.mjs` runs to completion without errors
- The generated `site/lib/eval-data.generated.ts` contains rows for the new species shape
- Spot check: there should be a row for `(escape-the-dungeon, gad, v12)` and `(escape-the-dungeon, bare, v6)`

**43-06** — Update the TypeScript types in `site/lib/eval-data.generated.ts` (or its source-of-truth type file) to reflect the new shape.

- Add `species`, `dna`, `cardImage`, `tagline`, `heroImage` to the row type
- Drop `evalMode`
- Update any consumer importing the type

**Verify**

- `tsc --noEmit` (or the project's typecheck command) passes for `site/`

### Milestone D — Tests + preservation contract (43-07)

**43-07** — Update `tests/eval-preservation.test.cjs` to expect the new paths and the new schema.

- Test asserts that for each species in each project, the canonical preservation paths exist:
  - `evals/<project>/species/<species>/v<N>/run/`
  - `apps/portfolio/public/evals/<project>/<species>/v<N>/`
- Drop assertions referencing `eval_mode`
- Run the test, fix any other tests broken by the schema rename

**Verify**

- `node tests/eval-preservation.test.cjs` (or `npm test`) passes

### Milestone E — Site display strings + CLI + docs (43-08, 43-09, 43-10)

**43-08** — Update site display strings across `vendor/get-anything-done/site/`.

- Rename "round" → "evolution" / "vN" → "generation N" in user-facing copy
- Replace "brownfield" / "greenfield" with no replacement (drop the framing)
- Add "DNA" and "spawn" where appropriate (species cards, generation pages)
- Touch hero copy, About page, project market, project detail, methodology pages, planning tab, findings index
- Use grep to find every instance, not just the obvious pages

**Verify**

- `grep -rn "\\bround\\b\\|brownfield\\|greenfield\\|\\bv1\\b" vendor/get-anything-done/site/app vendor/get-anything-done/site/components --include="*.tsx" --include="*.ts"` shows no user-facing string matches (allow code/variable names that haven't been renamed)
- Site builds and renders the new vocabulary

**43-09** — Update gad CLI help text and command surfaces.

- `gad eval list` uses "species" / "generation" terminology
- `gad eval preserve <project> <species> <generation>` (new signature) — old `gad eval preserve <project> <version>` either errors with a redirect message or accepts a new `--species` flag
- Help text for `gad project`, `gad eval`, `gad snapshot` uses new vocab
- Snapshot output uses new vocab

**Verify**

- `node bin/gad.cjs eval list` runs and prints species rows
- `node bin/gad.cjs --help` no longer mentions "round" or "v1/v2" in user-facing help

**43-10** — Update AGENTS.md, the Loop docs, README, and CHANGELOG with the new vocabulary.

- AGENTS.md sections that talk about "rounds" or "vN" now use evolution/generation
- README hero/intro copy updated
- CHANGELOG entry for phase 43 with breaking-change note
- Add the single transitional note to PROJECT.md (or top of ROADMAP.xml) per D-16

**Verify**

- `grep -n "\\bround\\b" AGENTS.md README.md` shows no current-tense usage (closed-phase historical references stay)

### Milestone F — Roadmap rename + cleanup (43-11)

**43-11** — Update ROADMAP.xml phase 44.5 title and remove "brood" references from active planning prose.

- Phase 44.5 title: "Brood Editor — local-dev project/eval playground" → "Species Editor — local-dev project/eval playground"
- Phase 44.5 goal text: replace "brood" / "Brood Editor" with "species" / "Species Editor", reserve `/project-editor` route name, embed the Lovable/Bolt-style species visualization scope from D-18 and the deferred ideas section of 43-CONTEXT.md
- Phase 45 goal text: drop the "(e.g. 'the bare species' v4 generation hatched a spawn that crushed the v4 brood')" example and replace with current vocabulary
- Closed phase prose stays verbatim per D-15

**Verify**

- `grep -n "brood\\|Brood" .planning/ROADMAP.xml` only matches inside historical/closed phase blocks (pre-43)

## Verification commands

After each milestone:
- `node bin/gad-tools.cjs init phase-op 43` — sanity check phase still resolves
- `node bin/gad.cjs snapshot --projectid get-anything-done` — sprint snapshot works

After Milestone E:
- `cd site && npm run build` (or whatever the site's build command is)
- `node tests/eval-preservation.test.cjs`

After Milestone F:
- Full smoke: `gad snapshot`, then visually scan the generated `eval-data.generated.ts` for old terminology

## Execution notes

- D-13 (single commit per the roadmap text) is interpreted as "the system is never left in a half-renamed working state on main between commits." Each task above commits independently when its delta leaves the system in a coherent state. Milestone B (schema migration) and Milestone C (data extractor) MUST land in close succession because they are mutually dependent — but they can be two consecutive commits as long as both land before the next plan/build/test command.
- D-27 (eval preservation contract) is honored: milestone D updates the test in lockstep with milestones B and C.
- Use `git mv` for all directory moves to preserve history, not `mv` + `git add`.

## Commits

(populated as tasks complete)
</content>
</invoke>