---
name: gad-author-context-framework
description: >-
  Author and register a context framework as a first-class catalog entry parallel
  to skills / agents / workflows / tech-stacks. Use when the user wants to bundle a
  reusable set of skills+agents+workflows under a named slug (e.g. "gad", "bare",
  "gsd"), when a species needs a `contextFramework` value that does not yet exist,
  or when proposing a new framework variant to run alongside GAD in the eval harness.
  Covers the on-disk shape, the site catalog wiring, and the species.json handshake.
source_phase: "42.4"
source_evolution: 2026-04-14-001
status: proto
---

# gad-author-context-framework

Context frameworks are the fifth catalog type in GAD, alongside skills, agents,
workflows, and tech-stacks (decision gad-179, phase 42.4-01). A context framework
is a **bundle-by-reference**: a single markdown file with YAML frontmatter that
names an existing set of skills, agents, workflows, and canonical projects. It is
the unit a species picks when it says `"contextFramework": "gad"` in its
`species.json`.

This skill is how you author a new one without breaking the catalog, the site
build, or the project ⊇ species inheritance contract (decision gad-184).

## When to use

- User wants to register a new framework variant (e.g. "bare", "gsd", or a
  research framework) that species can select via `contextFramework`.
- A species.json was edited to point at a `contextFramework` slug that does not
  resolve — the framework file is missing from `.planning/context-frameworks/`.
- You are preserving an emergent workflow as a first-class option so evals can
  compare it head-to-head against `gad` and `bare`.
- User asks "why isn't my framework showing up on the site?" — it almost always
  means the catalog parser did not find the file, or the frontmatter is malformed.

Do NOT use for: authoring an individual skill (use `create-skill`), authoring a
workflow (skills and workflows live in their own top-level directories), or
registering a tech-stack (different catalog).

## Pre-read

- `vendor/get-anything-done/.planning/context-frameworks/gad.md` — reference
  implementation. Copy this frontmatter shape.
- `vendor/get-anything-done/.planning/context-frameworks/bare.md` — the
  "no-framework" baseline. Shows how to author a deliberately-empty bundle.
- `vendor/get-anything-done/site/scripts/build-site-data.mjs` around line 1089
  (`parseContextFrameworks`) — the exact parser the site build uses. Your
  frontmatter must satisfy this function or the entry silently drops.
- `vendor/get-anything-done/lib/eval-loader.cjs` — reads `contextFramework` from
  project.json / species.json and hands it to downstream consumers.

## Steps

1. **Pick a slug.** Kebab-case, unique across `.planning/context-frameworks/`.
   This is the value species.json will reference. Check for collisions:
   ```sh
   ls vendor/get-anything-done/.planning/context-frameworks/
   ```

2. **Create the file.** Write `vendor/get-anything-done/.planning/context-frameworks/<slug>.md`.
   Minimum frontmatter (matches `parseContextFrameworks` at line 1100):
   ```yaml
   ---
   slug: <slug>
   name: <Human Name>
   description: One-line pitch. Decision gad-NNN if a decision motivates this.
   version: v0.1
   extends: null          # or parent slug if this is a derivative
   skills: []             # slugs that must exist under skills/
   agents: []             # slugs under agents/
   workflows: []          # slugs under .planning/workflows/
   canonicalProjects: []  # eval project slugs this framework is canonical for
   ---
   ```
   Everything after the frontmatter is rendered as the Overview / What-it-ships
   body on the catalog detail page.

3. **Verify the referenced slugs exist.** Every entry in `skills`, `agents`,
   `workflows`, `canonicalProjects` is a **reference**, not a definition. Dangling
   refs won't crash the build but will 404 on the site. Sanity-check with:
   ```sh
   ls vendor/get-anything-done/skills/
   ls vendor/get-anything-done/agents/ 2>/dev/null
   ls vendor/get-anything-done/.planning/workflows/
   ls vendor/get-anything-done/evals/
   ```

4. **Run the site data build.** The generator prints
   `[context-frameworks] parsed N framework(s)` — N should have incremented by
   one. If your new entry is missing, frontmatter is malformed.
   ```sh
   node vendor/get-anything-done/site/scripts/build-site-data.mjs
   ```

5. **Wire it into a species (optional but usually why you're here).** In the
   target `evals/<project>/species/<sp>/species.json`, set
   `"contextFramework": "<slug>"`. Keys are camelCase per decision gad-184 and
   task 42.4-19 — not `context_framework`. The project ⊇ species inheritance
   loader does literal key matching.

6. **Verify the eval loader resolves it.** The merged shape should show your
   framework slug:
   ```sh
   node vendor/get-anything-done/bin/gad.cjs eval list
   ```

7. **Update the canonical project list.** If this framework owns an eval project
   (i.e. it's the reference implementation), add the project slug to
   `canonicalProjects` in the framework's frontmatter and double-check the site
   detail page shows the link.

8. **Commit.** Per the GAD loop, update `TASK-REGISTRY.xml` with `skill`,
   `agent`, `type="framework"` attributes.

## Failure modes

- **Silent catalog drop.** The parser skips any file that isn't `*.md` or is
  named `README.md`. If `parseContextFrameworks` logs `parsed N` where N did
  not increment, the frontmatter YAML is malformed (tabs, unquoted colons,
  missing `---` fence). Run the build and read the log line.
- **Dangling references.** Nothing fails the build if you list a skill slug
  that no longer exists. The site detail page just renders a broken link. Audit
  against `ls skills/` before committing.
- **snake_case key on species.json.** Decision gad-184 + task 42.4-19: the
  inheritance merger does literal key matching, so `context_framework` silently
  coexists with `contextFramework` instead of overriding it. Always camelCase.
- **Forgetting `extends`.** If your framework is a derivative, set `extends` to
  the parent slug — the site renders a lineage badge from this field. Leaving
  it as `null` when it shouldn't be flattens the provenance story.
- **Duplicate public skill names.** Task 42.4-04/05/06 consolidated the skill
  catalog so duplicate public names fail a validator. If your framework's
  `skills` list pulls in two slugs that render the same public name, the
  catalog validator will reject it. Rename one before proceeding.

## Reference (file:line pointers)

- `vendor/get-anything-done/site/scripts/build-site-data.mjs:154` —
  `CONTEXT_FRAMEWORKS_DIR` constant.
- `vendor/get-anything-done/site/scripts/build-site-data.mjs:1089-1117` —
  `parseContextFrameworks()`, the authoritative parser. If in doubt about what
  frontmatter keys are read, read this function.
- `vendor/get-anything-done/site/scripts/build-site-data.mjs:576-589` — how
  species.json's `contextFramework` field is resolved into the merged shape
  consumed by the site (task 42.4-15).
- `vendor/get-anything-done/site/scripts/build-site-data.mjs:2199` —
  `CONTEXT_FRAMEWORKS` export fed to the generated catalog types.
- `vendor/get-anything-done/site/scripts/build-site-data.mjs:2854-2857` — the
  TypeScript interface for `contextFramework` on the species shape; notes the
  legacy `workflow` field is deprecated.
- `vendor/get-anything-done/.planning/context-frameworks/gad.md` — reference
  implementation with all fields populated.
- `vendor/get-anything-done/.planning/context-frameworks/bare.md` —
  deliberately-empty baseline.
- `vendor/get-anything-done/lib/eval-loader.cjs` — `loadResolvedSpecies`
  merges project defaults ⊇ species overrides; `contextFramework` flows
  through the same merge (decision gad-184).
- `vendor/get-anything-done/evals/escape-the-dungeon/species/gad/species.json` —
  example consumer setting `"contextFramework": "gad"`.
- `vendor/get-anything-done/site/app/context-frameworks/[slug]/page.tsx` — the
  detail route your framework lands on.

## Related patterns (from phase 42.4 dump)

Phase 42.4 carried a broader "catalog shape and sink coherence" agenda. If you
hit any of these adjacent problems, there is probably a dedicated skill waiting
to be split out:

- **Duplicate public skill-name consolidation** (tasks 42.4-04..06) — canonical
  `gad-*` naming, automated validator.
- **Canonical project file shape** (task 42.4-09, `references/project-shape.md`) —
  what `.planning/` files every project must have.
- **Sink coherence** (task 42.4-11) — which command edits what; `gad docs
  compile` vs `gad sink compile/decompile` vs `gad planning hydrate`.
- **Project ⊇ species inheritance** (tasks 42.4-14..19) — camelCase contract,
  `lib/eval-loader.cjs`, `species.json` rename from `gad.json`.
- **Multi-root eval discovery** (task 42.4-12) — `[[evals.roots]]` in
  `gad-config.toml` so downstream repos register eval projects without
  polluting the framework submodule.
