---
name: gad-safe-domain-rename
description: >-
  Execute a cross-cutting vocabulary/schema rename across a GAD project without
  losing git history, breaking preserved eval builds, or stranding docs. Use
  when a core domain term (e.g. "round"->"evolution", "brood"->"species",
  "mode"->"species") needs to be unified across CLI, schema, tests, site copy,
  and on-disk layout in one phase.
source_phase: "43"
source_evolution: 2026-04-14-001
status: proto
---

# Safe cross-cutting domain rename

## When to use

Trigger this skill when a phase's goal includes all of:

- A domain term changes meaning or spelling (e.g. phase 43's
  round/brood/mode -> evolution/species/generation).
- The term is baked into on-disk paths (`evals/<project>/<mode>/v<N>/`,
  `apps/portfolio/public/evals/...`), schema files (`gad.json`, generated
  TS interfaces), CLI help text, test fixtures, **and** site display copy.
- Preserved artifacts under `apps/portfolio/public/evals/` must stay
  readable (decision GAD-D-38 eval-preservation contract).
- Previous closed-phase prose in ROADMAP.xml must stay verbatim (decision
  baseline — closed history is immutable).

Do NOT use this skill for a single-file rename, a pure CLI flag change, or
a rename that does not touch on-disk paths.

## Steps

1. **Scope the blast radius first.** Before editing anything:
   - `node vendor/get-anything-done/bin/gad.cjs snapshot --projectid <id>`
     to see current phase + decisions.
   - Grep every occurrence of the old term across `vendor/get-anything-done/`,
     `apps/portfolio/`, and `evals/`. Split hits into four buckets:
     on-disk paths, schema/types, CLI surface, user-facing copy.
   - Write each bucket as a separate task in TASK-REGISTRY.xml. Phase 43
     used 11 tasks — aim for one task per bucket-per-subsystem, not one
     giant task.

2. **Delete before you rename.** If the rename drops variants entirely
   (phase 43 dropped all `etd-brownfield-*` and tech-stack variants),
   delete them in a dedicated first task with its own commit. This
   shrinks the surface area the rest of the phase has to migrate.
   Mirror the delete in `apps/portfolio/public/evals/` so preserved
   builds don't dangle.

3. **Move on-disk paths with `git mv` through a temp name.** Direct
   `git mv old new` works, but for case-only renames or collisions with
   existing children (e.g. merging `escape-the-dungeon-bare/` into
   `escape-the-dungeon/species/bare/`) use a two-step: `git mv X X.tmp`
   then `git mv X.tmp new/path/X`. This preserves `git log --follow`
   history and keeps `gad eval verify` passing after the move.

4. **Migrate the schema in one commit per file family.** Phase 43 split
   `gad.json` into `project.json` + `species.json`. When adding/removing
   fields:
   - Drop dead fields (e.g. `eval_mode`) in the same commit the new
     field lands, not later.
   - Stub forward-looking fields (`cardImage`, `tagline`, `heroImage`)
     as `null` so the schema is stable even before a later phase
     populates them.
   - Regenerate TS types (`site/lib/eval-data.generated.ts`) via the
     site build script rather than hand-editing.

5. **Rewrite the walkers, then the tests.** Any code that does
   `fs.readdir(evals/)` — in phase 43 that was `scanEvalProjects()` and
   `scanProducedArtifacts()` in `site/scripts/build-site-data.mjs` —
   must be rewritten to the new layout *before* you update
   `tests/eval-preservation.test.cjs`. Tests should assert both the
   positive shape (new paths exist) and negative shape (no flat
   legacy dirs remain at the top level). Exempt pre-rename data-loss
   cases via an explicit `KNOWN_PRE_PHASE_<N>_DATA_LOSS` set with a
   one-line comment per entry.

6. **Update the CLI surface last.** `gad eval list`, `gad eval preserve`,
   `gad eval verify`, and `gad snapshot` output must all speak the new
   vocabulary. Old flags should either error with a redirect message
   (`--version` -> "use --generation") or silently accept the new
   shape for one release. Verify with:
   ```sh
   node vendor/get-anything-done/bin/gad.cjs --help
   node vendor/get-anything-done/bin/gad.cjs eval --help
   ```

7. **Record the transitional note in planning, not code.** Add ONE
   paragraph to `PROJECT.md` or the top of `ROADMAP.xml` explaining
   "pre-phase-N phases used term X for what we now call Y". Do not
   rewrite closed phase prose — future readers need the old words to
   match their commit history.

8. **Update DECISIONS.xml with a single GAD-D-NNN entry** that names
   the new vocabulary and lists the dropped terms. Phase 43 used
   decision GAD-D-151 for this.

## Failure modes

- **Rewriting closed-phase prose.** Breaks auditability. Put the
  translation note in PROJECT.md instead.
- **Flat-to-nested move without `git mv`.** Loses blame history on
  every moved file. Always use `git mv`, even through a temp name.
- **Forgetting `apps/portfolio/public/evals/`.** The preserved-build
  mirror is a *second* copy of the layout. Failing to mirror the
  rename breaks decision GAD-D-38 and the preservation test.
- **Updating tests before walkers.** Produces a red build you have
  to navigate around during the rest of the phase. Walkers first,
  tests second.
- **Half-migrated CLI.** If `gad eval preserve` speaks the old
  vocabulary but `gad eval verify` speaks the new, agents mid-run
  will silently preserve to the wrong path. Migrate both surfaces
  in the same commit.
- **Dropping variants implicitly.** If a rename also drops a variant
  (greenfield/brownfield framing in phase 43), do it as an explicit
  numbered task with a decision reference, not as a side effect of
  the rename commit.

## Reference

- Phase 43 task list: `vendor/get-anything-done/skills/candidates/phase-43-domain-rename-project-species-schema-uni/CANDIDATE.md`
- Decision GAD-D-151 — evolutionary domain vocabulary lock
- Decision GAD-D-38 — eval preservation contract
- Walkers: `vendor/get-anything-done/site/scripts/build-site-data.mjs`
  (`scanEvalProjects`, `scanProducedArtifacts`, `listEvalSpecies`,
  `listEvalGenerations`, `listEvalProjects`)
- Test: `tests/eval-preservation.test.cjs`
- CLI entry: `vendor/get-anything-done/bin/gad.cjs` (eval subcommand)
