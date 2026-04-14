---
name: add-site-surface
description: >-
  Add a new data surface (route, chart, detail page, catalog, or export) to the
  GAD public site at vendor/get-anything-done/site/. Use when the user asks to
  "add a page for X", "surface Y on the site", "expose Z in the catalog", "build
  a chart of W", or when a new eval/finding/hypothesis/skill needs a
  deep-linkable home. Also use when adding an agent-crawlable export (llms.txt,
  api/docs.json).
source_phase: "22"
source_evolution: 2026-04-14-001
status: proto
---

# add-site-surface

## When to use

Trigger this skill whenever you need to make a new slice of repo state visible
on the public site. Phase 22 shipped ~20 distinct surfaces (per-run pages,
per-project pages, /findings, /hypotheses, /methodology, /lineage, /roadmap
chart, /emergent skill modal, llms.txt, api/docs.json, SVG charts on the home
page, Remotion video scaffold) and every one of them followed the same recipe.
This skill is that recipe.

Do NOT use this skill for:

- Refreshing existing surfaces after content changes — that's `portfolio-sync`.
- Publishing generated docs into a docs sink — that's `gad:docs-compile`.
- Authoring eval data or decisions — those belong in `evals/` and
  `.planning/DECISIONS.xml`, which this skill reads but never writes.

## Core principle

**The filesystem is the source of truth. The site is a pure function of it.**
Every surface is built by:

1. a prebuild script that reads `evals/`, `skills/`, `agents/`, `commands/`,
   `.planning/`, and emits typed data files,
2. a Next.js route that imports those typed files and renders them,
3. optional pure-React-SVG components (no charting library) for visuals.

If you find yourself hand-editing anything under `site/lib/*.generated.ts` or
`site/public/llms*.txt` you have taken a wrong turn — always change the emitter.

## Steps

1. **Locate where the data already lives in the repo.** Most surfaces read one
   of: `evals/<project>/<version>/TRACE.json`, `evals/<project>/gad.json`,
   `skills/<name>/SKILL.md` frontmatter, `agents/<name>.md` frontmatter,
   `.planning/DECISIONS.xml`, `.planning/docs/FINDINGS-*.md`. If the data
   doesn't exist yet, stop — the surface is premature. Capture a task instead.

2. **Extend the emitter, don't create a new one.** The single prebuild entry
   point is `vendor/get-anything-done/site/scripts/build-site-data.mjs`. Add
   your scan + transform alongside the existing sections and write into one of
   the canonical outputs:
   - `site/lib/eval-data.generated.ts` — per-run, per-project, scores, gates,
     process metrics (search `[3/4] Writing lib/eval-data.generated.ts` around
     line 2502).
   - `site/lib/catalog.generated.ts` — skills, agents, commands, templates
     (search `[write] lib/catalog.generated.ts` around line 1990).
   - `site/public/llms.txt`, `site/public/llms-full.txt`,
     `site/public/api/docs.json` — agent-crawlable exports (lines ~1592–1712).
   - Static JSON under `site/data/*.json` — only for hand-curated content like
     `hypotheses.json`, `rounds.json`, `self-eval-config.json`. Emitters should
     NOT write here.

3. **Type the output.** Every generated `.ts` file is a TypeScript module with
   an exported `const` and a matching interface. Grep an existing export
   (e.g. `EvalRun`, `CatalogSkill`) and mirror the shape. Never emit untyped
   JSON into `lib/`.

4. **Add the route.** Routes live under `site/app/<segment>/page.tsx`. For
   per-item detail pages use dynamic segments the same way existing ones do:
   - `site/app/runs/[project]/[version]/page.tsx` — per-run pattern
   - `site/app/projects/[...id]/page.tsx` — per-project pattern
   - `site/app/findings/[slug]/page.tsx` — per-finding pattern
   - `site/app/skills/[id]/page.tsx` — catalog-item pattern
   Import data from `@/lib/...generated` — never `fs.readFile` at request time
   (the site ships as `next export`).

5. **Render with existing components.** Before writing new UI, grep
   `site/components/` for what you need:
   - `components/charts/` — pure-React SVG charts (phase 22 rule: no charting
     library). Follow this for any new graph. See task 22-24.
   - `components/run-detail/` — score bars, dimension breakdown, gate reports.
   - `components/detail/` — generic detail-page primitives.
   - `components/landing/` — home-page sections.

6. **Wire navigation.** Add the route to the site-wide nav in
   `site/components/layout/` (or wherever the current header lives — grep for
   an existing nav entry like `"methodology"` to find it). Nav is tight; if
   you're adding a fifth top-level item, negotiate space rather than pile on.

7. **Regenerate and build.** This is the verification loop — a surface only
   exists if both commands succeed:

   ```sh
   cd vendor/get-anything-done/site
   npm run prebuild
   npx next build
   ```

   `npm run prebuild` runs `scripts/build-site-data.mjs`. A broken emitter will
   fail here, not at page-render time. Read the `[1/4] ... [4/4]` progress
   lines — they tell you which stage broke.

8. **Commit generated outputs alongside source.** Generated `.ts` and
   `public/llms*.txt` files MUST be committed. They are the contract between
   the emitter run and the static export. Do not `.gitignore` them.

## Failure modes

- **Hand-editing a generated file.** It will be clobbered on next prebuild.
  Every generated file has an `Auto-generated from ... — do not edit` header
  comment. Respect it.
- **Adding a charting library.** Phase 22 explicitly rejected this (task
  22-24). Write pure-React SVG; it ships cleanly through `next export`.
- **Request-time filesystem reads.** The site is statically exported. Any
  `fs.readFile` inside a `page.tsx` will break the build or the deploy.
- **YAML frontmatter with raw colons.** Skills and agents are parsed by
  js-yaml; descriptions containing `:` must use the folded block scalar
  `description: >-` form. See task 22-35 and decision gad-78.
- **Drifted catalog entries for emergent skills.** Skills with
  `excluded-from-default-install: true` (e.g. session-discipline) live under
  `skills/emergent/` and must remain distinguishable in the catalog scan. See
  task 22-36 and decision gad-79.
- **Forgetting the agent-crawlable export.** If your new surface introduces a
  new data kind, also emit it into `llms-full.txt` and `api/docs.json`
  (schema id `gad-docs-v1`) so external agents can see it without HTML crawling.

## Reference

- `vendor/get-anything-done/site/scripts/build-site-data.mjs` — single prebuild
  emitter. Lines ~161–162 (output paths), ~1592 (llms.txt), ~1683–1712
  (api/docs.json), ~1990 (catalog), ~2502 (eval-data).
- `vendor/get-anything-done/site/lib/eval-data.generated.ts` — generated run
  and project data consumed by every eval-facing page.
- `vendor/get-anything-done/site/lib/catalog.generated.ts` — generated skills,
  agents, commands, templates catalog.
- `vendor/get-anything-done/site/app/` — all routes. See `runs/[project]/`,
  `projects/[...id]/`, `findings/[slug]/`, `skills/[id]/`, `hypotheses/`,
  `methodology/`, `lineage/`, `gad/`, `roadmap/`, `freedom/`, `emergent/`.
- `vendor/get-anything-done/site/components/charts/` — SVG chart components
  (HypothesisTracksChart and friends) referenced by tasks 22-24, 22-40, 22-54.
- `vendor/get-anything-done/site/components/run-detail/` — composite-score and
  gate-report primitives referenced by task 22-04.
- `vendor/get-anything-done/site/data/hypotheses.json`,
  `site/data/rounds.json` — hand-curated inputs (tasks 22-29, 22-41).
- `vendor/get-anything-done/skills/portfolio-sync/SKILL.md` — the adjacent
  skill for *refreshing* existing surfaces after content changes.

## Related patterns

Phase 22 also contained two secondary patterns worth capturing later, but
folded here as signposts rather than separate skills:

- **Framework-version stamping + re-running past evals** (task 22-27, cancelled
  at phase 22, deferred to phase 25). Candidate for a future
  `framework-upgrade-replay` skill.
- **Per-skill evaluation harness** (`gad eval skill <name>`, task 22-52,
  cancelled pending gad-86). Candidate for a future `skill-eval-harness` skill
  once the trace v4 schema stabilizes.

Do not split these out until the underlying CLI surfaces exist.
