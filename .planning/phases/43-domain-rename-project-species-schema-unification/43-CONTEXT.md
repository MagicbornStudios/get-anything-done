# Phase 43: Domain rename + project/species schema unification - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Two atomic moves shipped in a single commit:

1. **Schema unification.** Today's three sibling eval projects (`escape-the-dungeon`, `escape-the-dungeon-bare`, `escape-the-dungeon-emergent`) physically merge into one parent **project** directory. Each former sibling becomes a **species** row inside that project. The marketplace lists projects; the project page shows species; each species shows its generations.

2. **Domain rename.** A coherent biology-flavored vocabulary replaces today's mixed wording across gad.json, build-site-data, every site page, the `gad` CLI + help text, AGENTS.md, the Loop docs, and any new ROADMAP/STATE/DECISIONS prose written from this phase forward.

Display strings, types, and physical directory grouping only. Eval preservation paths (decision gad-38) stay stable through the migration. No new product capabilities — those belong to phase 44 (Project Market redesign), 44.5 (Species Editor + Project Editor), and 45 (rebrand).
</domain>

<decisions>
## Implementation Decisions

### Vocabulary lock (the rename mapping)

- **D-01:** `round` → **evolution**. An *evolution* is a project-level event: any time a project's requirements change, the project evolves. An evolution propagates across the project's species and triggers new generations.
- **D-02:** `v1`, `v2`, … (per species) → **generation**. A generation is the build a single species produced for a given evolution. "Escape the Dungeon / bare / generation 4" is one row.
- **D-03:** No name for the cross-species cohort. The plural `generations` with an evolution number ("the v4 generations" / "generations from evolution 4") is sufficient. We are explicitly NOT coining `brood`, `clutch`, `hatch`, `wave`, `epoch`, or `cohort`. Adding a word to fill the slot is exactly the vocabulary bloat phase 45 is meant to remove.
- **D-04:** The skill manifest baked into a species → **DNA**. A species' DNA defines which skills, workflow, and configuration that species inherits.
- **D-05:** The bundle a generation produces (build artifacts + planning docs + trace + commits + reviews) → **spawn**. "The v4 generation's spawn" = everything that generation produced.
- **D-06:** The parent container of species → **project**. Already the term in use; phase 43 formalizes that one project owns many species.

### Species identity

- **D-07:** Species identity tuple is **`(project, context_framework, tech_stack)`**. Workflow is NOT in the tuple — workflow lives inside DNA as a property of the species. This implements decision gad-176 (context framework as first-class axis) and decision gad-178 (skills determine workflows). Choosing this tuple was option (d) in the discussion.
- **D-08:** Today's three Escape the Dungeon species (`gad`, `bare`, `emergent`) are a special case where the differentiator happens to be context framework, not tech stack. After the rename they become three species rows whose `context_framework` differs (`gad`, `bare`, `emergent`) and whose `tech_stack` is identical. Future projects may instead vary by `tech_stack` while keeping `context_framework` constant. Both shapes are valid.

### Directory layout

- **D-09:** Physical merge. The three sibling directories collapse into one parent project directory with species subdirectories. Approximate layout:
  ```
  evals/escape-the-dungeon/
    project.json            # parent project metadata (was gad.json's project-level fields)
    species/
      gad/
        species.json        # species-level metadata (DNA, context_framework, tech_stack)
        generations/
          v1/ ... v4/
      bare/
        species.json
        generations/v1 ... v4/
      emergent/
        species.json
        generations/v1 ... v4/
  ```
  Exact filenames + nesting are a planning concern — the principle locked here is "one parent dir, species subdirs, generations under each species."
- **D-10:** Eval preservation paths (decision gad-38) MUST remain readable at their current canonical locations: `evals/<project>/v<N>/run/` and `apps/portfolio/public/evals/<project>/v<N>/`. The migration script writes both old + new paths or symlinks/redirects so `tests/eval-preservation.test.cjs` continues to pass without modification. The exact mechanism (symlink vs path-aware reader vs duplicate write) is for the planner; the constraint is non-negotiable.
- **D-11:** Old top-level dirs (`escape-the-dungeon-bare`, `escape-the-dungeon-emergent`) are deleted in the same commit as the merge. No transitional sibling-dir period.

### Migration mechanism

- **D-12:** One-shot migration script (`gad migrate-schema-43` or equivalent). It rewrites every gad.json/project.json/species.json + every planning doc reference + every site display string in one pass. No runtime dual-read adapter — the codebase reads the new shape only after the commit.
- **D-13:** Single commit. The roadmap mandates "single commit so we never half-rename" and that holds. The migration script + every touched file land together. If the commit fails verification, we reset and retry — we never ship a half-renamed state.

### Pull-forward into phase 44

- **D-14:** Phase 43 delivers the data shape phase 44 will consume. Specifically: the new `project.json` schema includes stub fields for `cardImage`, `tagline`, `heroImage` (nullable / empty for now), so phase 44 only has to add UI + populate values, not introduce schema fields. This was an explicit "deliver, don't strict-scope" call.

### History rewrite policy

- **D-15:** Going-forward only. Closed phases (1 through 42.x), historical DECISIONS.xml prose, and historical phase titles (e.g. "Round 4 greenfield") stay verbatim. Rewriting closed history is revisionism, risks breaking `gad-NNN` references, and risks broken external links into the site. New writing — site display strings, types, CLI help text, new phase prose, AGENTS.md, the Loop docs, README — uses the new vocab exclusively.
- **D-16:** A single transitional note lands in PROJECT.md (or the top of ROADMAP.xml) saying: "Phases before 43 used 'round' for what we now call 'evolution,' and 'v1/v2' per project for what we now call 'generation' per species." That's the only translation aid; we don't backfill the history.

### Disk-reality corrections (added 2026-04-13 after surveying evals/)

The initial discuss round assumed three sibling escape-the-dungeon dirs. Disk reality showed 12+ siblings across three axes (framework, tech-stack, brownfield). Corrections after a follow-up round:

- **D-19:** Final species set per multi-variant project is exactly **three: `gad`, `bare`, `emergent`**. No `gad-emergent`, no `planning-only`, no per-tech-stack species, no per-mode species.
- **D-20:** `gad-emergent` as a condition is **deleted**. Rationale: gad IS emergent — testing them as separate conditions is no longer meaningful. Affects: delete `evals/escape-the-dungeon-gad-emergent/`.
- **D-21:** `planning-only` as a condition is **deleted**. Not testing that hypothesis anymore. Affects: delete `evals/escape-the-dungeon-planning-only/`.
- **D-22:** Brownfield as a mode is **dropped from code, copy, schema, and projects**. The terminology is preserved internally for historical reference (DEFINITIONS.md, closed phase prose) but no current project, species, or display string uses the word "brownfield" or "greenfield" after this phase. Affects: delete `evals/etd-brownfield-bare/`, `evals/etd-brownfield-gad/`, `evals/etd-brownfield-emergent/`. The `eval_mode` field is removed from the schema.
- **D-23:** Tech-stack variants are **deleted** (not migrated as species). The user is not testing tech-stack variation under the new schema. Affects: delete `evals/etd-babylonjs/`, `evals/etd-phaser/`, `evals/etd-pixijs/`, `evals/etd-threejs/`. The `tech_stack` *field* still exists in the schema (per D-07's tuple) but it's a property of the species, not an axis we're populating with extra rows right now. For escape-the-dungeon all three species share a single (unspecified / vanilla) tech_stack value.
- **D-24:** The species tuple D-07 is **simplified in practice** to `(project, context_framework)` for current data, with `tech_stack` retained in the schema as an optional differentiator that defaults to the project's canonical stack. Future projects may populate it; current projects do not.
- **D-25:** Same merge pattern applies to **`gad-explainer-video`**: parent dir `evals/gad-explainer-video/` contains three species (`gad`, `bare`, `emergent`) under `species/`. Today's `gad-explainer-video` becomes the `gad` species, `gad-explainer-video-bare` becomes `bare`, `gad-explainer-video-emergent` becomes `emergent`.
- **D-26:** Migration mechanics for the parent rename: today's `evals/escape-the-dungeon/` (which IS the gad species) is moved to `evals/escape-the-dungeon/species/gad/` via a temp-rename intermediate. Same for `gad-explainer-video`.
- **D-27:** Eval preservation contract (gad-38) reinterpretation under the new layout. The old paths (`apps/portfolio/public/evals/escape-the-dungeon-bare/v4/`) are migrated to new paths (`apps/portfolio/public/evals/escape-the-dungeon/bare/v4/` or equivalent). The migration script handles both source eval dirs AND preserved build dirs in lockstep. `tests/eval-preservation.test.cjs` is updated in the same commit to expect the new paths. The contract becomes "every species/generation has a preserved build" — same intent, new addressing.
- **D-28:** No other projects in `evals/` (cli-efficiency, reader-workspace, gad-skill-creator-eval, etc.) require restructuring — they are single-species single-generation projects today and stay that way. They get their gad.json migrated to the new schema (project + species fields) but no directory moves.

### Surface naming carried into phase 44.5

- **D-17:** The phase currently titled "Brood Editor" is renamed **Species Editor**. Route slug becomes `/species-editor` (or `/projects/[id]/species/[species]/edit`). Phase 43 updates the roadmap title + any references to "brood" in planning prose so phase 44.5 inherits the corrected name.
- **D-18:** A parent **Project Editor** surface is also part of phase 44.5's expanded scope (captured in Deferred Ideas below) — phase 43 reserves the route name `/project-editor` (or `/projects/[id]/edit`) so 44.5 can claim it without renaming again.

### Claude's Discretion

- Exact filenames inside the merged dir layout (`project.json` vs `gad.json` at the project level; `species.json` vs `dna.json` at the species level) — pick whatever maps cleanest to the existing parser code in `lib/build-site-data.mjs`.
- Whether the migration script is a new `gad migrate-schema-43` subcommand or a one-off node script under `scripts/migrations/` — both are acceptable; subcommand is preferred if `gad` already has a migration namespace.
- Mechanism for keeping eval preservation paths readable (symlinks vs path-aware reader vs duplicate-write) — pick the one that touches the fewest tests.
- The exact wording of CLI help text for renamed commands — match existing tone.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + state
- `vendor/get-anything-done/.planning/ROADMAP.xml` §phase 43 — the goal text and the dependent phases (44, 44.5, 45)
- `vendor/get-anything-done/.planning/STATE.xml` — current sprint window
- `vendor/get-anything-done/.planning/DECISIONS.xml` — decisions gad-38 (eval preservation contract), gad-160 through gad-179 (the upstream lock-in for context frameworks, workflows, proto-skills, GAD framing)

### Data shape + migration touchpoints
- `vendor/get-anything-done/lib/build-site-data.mjs` — the data extractor that groups eval rows; needs to learn the new project/species/generation grouping
- All `evals/escape-the-dungeon*/gad.json` files — the source-of-truth files the migration script must rewrite
- `tests/eval-preservation.test.cjs` — the test that enforces decision gad-38; the migration must not break it
- `vendor/get-anything-done/lib/eval-preservation.cjs` (or wherever `gad eval preserve` lives) — must keep writing to the canonical paths

### Site display surfaces (every page that prints "round" / "v1" / "bare" / etc)
- `apps/portfolio/app/project-market/` — current marketplace page
- `apps/portfolio/app/projects/[id]/` — project detail
- `apps/portfolio/app/findings/` — whitepapers, may reference "round" historically
- `apps/portfolio/app/planning/` — workflows tab + framework comparison
- Any nav components, hero copy, About page

### CLI surfaces
- `vendor/get-anything-done/bin/gad.cjs` and `bin/gad-tools.cjs` — command help text
- `vendor/get-anything-done/AGENTS.md` and the Loop docs — agent-facing prose

### Upstream phase context (read for prior decisions, do not modify)
- `vendor/get-anything-done/.planning/phases/42-evolution-loop/` — original evolution-loop framing
- `vendor/get-anything-done/.planning/phases/42.3-workflows-first-class/` — workflows-as-first-class lock-in
- `vendor/get-anything-done/.planning/phases/42.4-context-framework-catalog-type/` — context framework axis lock-in
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `build-site-data.mjs` already groups eval rows; the merge changes the grouping key (parent project) but not the extraction pipeline.
- The site already has `/projects/[id]` detail pages — they need to render species rows instead of a flat generation list.
- `gad eval preserve` already writes to canonical paths — we wrap it, not replace it.
- The Workflows tab (phase 42.3) and Context Frameworks pages (phase 42.4) already render catalog types — Species rendering can borrow their card patterns.

### Established Patterns
- gad-38 forbids breaking eval preservation paths under any circumstances — this is the single hardest constraint on the migration design.
- Decision gad-176 + gad-178 + gad-179: context framework is a first-class axis parallel to workflow, GAD stays framed as a framework, skills determine workflows. Phase 43's species tuple `(project, context_framework, tech_stack)` is downstream of these decisions and must not contradict them.
- Single-commit atomic refactors are the project's norm for vocabulary changes (see prior decisions on decision-id renumbering).

### Integration Points
- gad.json schema → species.json + project.json split
- build-site-data.mjs → grouping change
- Every site page touching display strings → string replacements (mechanical, but many sites)
- gad CLI help text → string replacements
- ROADMAP/STATE/AGENTS prose written from now on → new vocab
</code_context>

<specifics>
## Specific Ideas

- The Lovable / Bolt aesthetic for the Species Editor's "no build yet" state (DNA + context framework + tech stack + standard-config visualization) — captured in Deferred Ideas for phase 44.5, not in 43.
- The /project-editor surface (parent of species editors) where the operator can see all species and generations in one project, edit project-level requirements, and launch new species — also for 44.5. Phase 43 only reserves the route name and the vocabulary.
- The Playable viewport pattern (already shipped) is the right shape for showing generation builds inside the editors — 44.5 reuses it.
</specifics>

<deferred>
## Deferred Ideas

### For phase 44.5 (Species Editor scope expansion)
- **Project Editor surface.** A parent surface that shows all species and generations in one project at once. Lets the operator edit project-level requirements and launch / create new species rows. Sibling to the Species Editor.
- **Species Editor "no-build" visualization.** When viewing a species that has no generation built yet, render a visualization of the species' DNA, context framework, tech stack, and any other standard configuration fields (ports, env vars, model selections, anything an online app-generation company like Lovable or Bolt would surface). This becomes the "blank canvas" view of the editor.
- **Multi-species multi-generation gallery inside the Project Editor.** The project page in browse mode (phase 44) is a card grid; the Project Editor mode (phase 44.5) is the same data but with mutate affordances.

### For phase 44 (Project Market redesign)
- The cardImage / tagline / heroImage fields land as schema stubs in phase 43 (D-14). Phase 44 populates and renders them.

### Reviewed Todos (not folded)
- None — no pending todos matched phase 43 scope at this time.
</deferred>
</content>
</invoke>