---
status: candidate
source_phase: "44.5"
source_phase_title: "Project Editor + Brood Editor — local-dev gamified species/brood/generation workspace"
pressure_score: 29
tasks_total: 15
tasks_done: 1
crosscuts: 7
created_on: "2026-04-15"
created_by: compute-self-eval
---

# Candidate from phase 44.5

## Phase

```
get-anything-done | 44.5 | Project Editor + Brood Editor — local-dev gamified species/brood/generation workspace
selection pressure: 29  (15 tasks, 1 done, 7 crosscuts)
```

## Tasks

```
44.5-01 planned Scaffold the Project Editor route at `/projects/[id]/edit` (new route, separate from the existing `/projects/[...id]` listing detail catch-all), gated to `NODE_ENV=development`. First cut: three-pane split viewport shell with NO real editing yet — left pane placeholder for bestiary grid, right pane placeholder for iframe live preview, bottom pane placeholder for minecraft inventory grid config inspector. Every pane gets an explicit `SiteSection cid="project-editor-&lt;pane&gt;-site-section"` literal, participates in the visual context panel + modal-footer CRUD loop, and is grep-able by cid — per decision gad-189 and the Visual Context System mandate. Renders against `projects/project-editor/project-editor/` as the dogfood target. Does NOT implement edit affordances or the dev bridge — this task is the shell only. Must include a visible "Project Editor (dev mode)" dev-panel badge so the operator can see the gate status. Acceptance: route renders in dev with empty panes + cids; `/projects/[...id]` listing detail unchanged; tsc clean; at least one prompt from the visual-context-modal-footer round-trips against a pane cid (proves the Visual Context System is wired before any editor feature work starts).
44.5-01a done Visual Context System reference research for 44.5-01 (discuss-phase deliverable, not a code task). Before PLAN.md is written for 44.5-01, enumerate the exact set of existing Visual Context System components, skills, decisions, and file paths that the Project Editor route will consume: (a) the `SiteSection cid` pattern source (site/components/...), (b) the visual-context-panel component + its modal footer CRUD form, (c) the `gad-visual-context-panel-identities` skill, (d) decisions gad-186/187, (e) how the panel participates in portal modals (decision point from phase 42 work), (f) how dev-id band scan discovers new sections, (g) the global search hook that indexes cids, (h) any missing pieces that would need to be built before the editor can meet the mandatory Visual Context coverage requirement. Produce a short reference index (not a full plan) used as the "references" section of 44.5-01's KICKOFF.md. This closes the user's "make sure what references will be needed for implementation is understood" instruction from 2026-04-15.
44.5-01b planned Draft/published model — add `published: false` boolean to `project.json` schema (default draft) + reserve `published` on `species.json` without enforcing yet. Update `/project-market` page component to filter `FEATURED_PROJECTS` / marketplace lists to `published === true`; add a "no published projects yet — browse drafts in the editor" empty state with a CTA that routes to the Project Editor. Update `build-site-data.mjs` or equivalent data generator to read the new field and surface it on every project record. `/projects/[...id]` listing detail and `gad eval list` remain unfiltered per decision gad-189. Operator-facing flip is a single checkbox in the editor (44.5-01c). Schema migration: touch every existing `project.json` to add `"published": false` explicitly — do not rely on missing-field-means-draft, because the difference between "not yet touched" and "explicitly draft" matters for later auditing. Acceptance: `/project-market` renders the empty state with the editor CTA until at least one project flips published.
44.5-01c planned "Open in Editor" CTA on the existing `/projects/[...id]` listing detail page. Adds a single button/link in the listing header that routes to the new `/projects/[id]/edit` editor surface, visible only when `NODE_ENV=development` or the dev-panel equivalent flag. Button gets its own cid. Also adds the reverse nav — an "Exit to listing" link in the editor shell that routes back to the listing detail for the same project. Both links participate in the visual context panel.
44.5-01d planned Update `project-skills-scope-section-site-section` data source on the listing detail (`/projects/[...id]`). The panel stays in place but its current data source (project-level skill catalog) changes to brood/generation-aggregated skill usage pulled from the project's accumulated broods. The aggregation walks every species's generations under the project and sums skill invocations from each generation's preserved trace/attribution data. `build-site-data.mjs` gains a `projectBroodSkillAggregation` helper that produces the input record. Panel UI unchanged beyond the numbers — still source-searchable via the existing cid, still grep-able, still wired to the visual context panel. Acceptance: panel on the listing shows non-zero numbers for app-forge after aggregating app-forge v1's preserved trace, and shows zero + empty state for project-editor (baseline species inherits, no generations yet).
44.5-02 planned Dev-server command bridge: Node child-process bridge behind a dev-only API route that rejects all requests unless NODE_ENV=development. First cut is permissive: accepts any `gad *` and any `npx *` command so we can iterate on the editor surface without fighting the allow-list. Hardening (explicit allow-list, argument sanitization, per-command timeout tuning) is deferred to a follow-up task after the editor's happy path is proven. Stream stdout/stderr back to the browser via Server-Sent Events or similar. Explicitly rejects production requests at module load time so the wide-open dev surface can never ship in prod.
44.5-02b planned Hardening pass for the dev-server command bridge: after 44.5-02 proves the editor works, replace the permissive "any gad/npx" acceptance with an explicit allow-list (`gad evolution status|validate|promote|discard`, `gad snapshot`, `gad state`, `gad tasks`, `npx` commands scoped to the eval repo, `pnpm|npm|yarn` install/build/test), add argument sanitization, per-command timeout tuning, and structured error responses. Keep the NODE_ENV=development gate as the primary safety â€” the allow-list is defense in depth.
44.5-03 planned Live-edit eval folder from the editor: file-system adapter that reads/writes requirements.md, gad.json, per-species overrides, and manifest entries for the currently-selected project, guarded by the same dev-only gate as 44.5-02. No schema validation in this task â€” focus on the round-trip (read file â†’ edit in browser â†’ write file â†’ trigger rebuild).
44.5-04 planned Species/population/generation/brood capture surfaces inside the editor: inspector panes showing the currently-edited project's species rows, each species's brood (accumulated generations), and the cross-species view for the same project. Reuses phase 44 marketplace components but flips affordances from browse to "active editing" with visible row-level mutation indicators. Every row gets a cid. Per decision gad-189 the vocabulary is locked — inspector pane labels read "Species", "Brood", "Generation", "Recipe" and must not drift.
44.5-05 planned Minecraft-style inventory grid primitive for config editing. Reusable React component that renders an object (gad.json / species.json / recipe config) as a grid of slots where each slot represents one config key. Features: drag-and-drop between slots, typed slot variants (string/number/boolean/enum/nested-object → opens sub-grid), hover tooltip showing current value + source path, click-to-edit inline or modal editor for complex values, visual "crafting" animation when a recipe combination is recognized. Every slot has a deterministic cid derived from the config key path so slots are individually grep-able (`inventory-slot-gad-json-sprint-size-site-section`). Primary surface for 44.5-03 file-system round-trip. Prototype first in Storybook-equivalent isolation before wiring to real data.
44.5-06 planned Recipe CRUD surface inside the Project Editor. Recipes are reusable species templates owned by the project (per decision gad-189). This task: (a) define the `recipe.json` schema — name, description, base species slug, default gad.json overrides, list of required inputs, list of expected outputs; (b) store recipes at `projects/&lt;project&gt;/&lt;project-editor-slug&gt;/recipes/&lt;recipe-slug&gt;/recipe.json` alongside species/; (c) editor UI: list of recipes in the Project Editor shell, create/edit/delete buttons (each with a cid), a form backed by the inventory-grid primitive from 44.5-05; (d) "run recipe" action that produces a new species in the project's species/ directory and triggers an eval generation via the command bridge; (e) a recipe-level cid so the modal footer CRUD can target recipes. No inheritance-from-recipe runtime yet — first cut is "recipe authors a species, species runs normally".
44.5-07 planned Bestiary view — read-only UI for a project's accumulated broods. Renders as a grid of bestiary-entry cards, one per species, each card showing: species name, generation count, newest generation thumbnail, animated trait bars for the 6-8 key traits (44.5-08 dependency), click-to-expand inline panel showing all generations in the species's brood with a visual diff tree (44.5-09 dependency) highlighting which traits changed between adjacent generations. Card cids are deterministic on species slug; generation-row cids are deterministic on species+version. The bestiary is the primary left-pane in the editor's split viewport for 44.5-01. Acceptance: app-forge's bestiary shows one species (gad) with one generation (v1); project-editor's bestiary shows one species (app-forge-baseline) with its inherited-baseline badge and zero generations of its own.
44.5-08 planned Animated trait bar + radar chart primitives. (a) Trait bar: horizontal bar per trait, animates on mount from 0 to current value, color-coded by trait category, tooltip shows trait source (species.json field or derived metric). Reusable as both a standalone component and a row inside a bestiary card. (b) Radar chart: 6-8 axes showing the species's trait vector, with the ability to overlay multiple species for comparison. Prototype first — operator has not seen one yet and will give feedback after live. Both primitives get cids and a modal-footer-editable representation. Prototype in isolation before wiring to real species data.
44.5-09 planned Visual diff tree primitive. Renders a side-by-side (or overlaid) tree view of two config objects (typically generation N vs generation N+1) where changed leaves glow with a color gradient indicating change direction (+/- for numerics, added/removed/modified for strings/objects). Used inside bestiary-card expansion (44.5-07) to surface what changed between generations in a species's brood. Every diff-row has a cid derived from the config key path for grep-ability. Accepts arbitrary JSON — schema-agnostic by design so it works for gad.json, species.json, recipe.json, and future types.
44.5-10 planned iframe live-preview primitive for the editor's right pane. Takes a generation identifier (project/species/version) and renders the preserved static build from `apps/portfolio/public/evals/&lt;project&gt;/v&lt;N&gt;/` in a sandboxed iframe. Includes: device-frame chrome selector (desktop/tablet/mobile), reload button, "open in new tab" link, URL path input for SPA routes, and a fallback screenshot when the build isn't live-servable. Gets a cid. Integrates with the Visual Context System such that the modal footer can target either the iframe wrapper or (via postMessage when the inner build opts in) the selected element inside the iframe. Primary right-pane content for 44.5-01's split viewport.
```

## What this candidate is for

This file was auto-generated by `compute-self-eval.mjs` because phase
44.5 exceeded the selection pressure threshold. High pressure
signals a recurring pattern that may want to become a reusable skill.

This is the **raw input** to the drafting step. The drafter (`create-proto-skill`,
invoked by `gad-evolution-evolve`) reads this file and decides what the
skill should be. No curator pre-digestion happens — see the 2026-04-13
evolution-loop experiment finding for why
(`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md`).

## How the drafter should enrich this

The drafter should pull additional context from:

- `gad decisions --projectid get-anything-done | grep -i <keyword>` —
  relevant decisions for this phase
- `git log --follow --oneline <file>` — historical context for files this
  phase touched (catches the "three attempts at task X failed" thread that
  lives in commit history)
- `gad --help` and `gad <subcommand> --help` — CLI surface available
  to the skill
- `ls vendor/get-anything-done/skills/` — existing skills to avoid
  duplicating

The drafter does **not** ask a human for anything. Make decisions and
document them in the SKILL.md.

## Output location

The drafter writes to `.planning/proto-skills/phase-44.5-project-editor-brood-editor-local-dev-ga/SKILL.md` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in `skills/` as part of species DNA

The human reviewer runs `gad evolution promote <slug>` or
`gad evolution discard <slug>` after reviewing the proto-skill.
