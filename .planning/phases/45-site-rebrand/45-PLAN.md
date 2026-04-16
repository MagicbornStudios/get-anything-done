# Phase 45: Site Rebrand — PLAN

## Goal

The big polish pass after the rename and marketplace land. Refresh the visual identity, type ramp, color palette, hero copy, About page, README, and external-facing docs around the new species/generation/DNA/evolution language. Make the site read playfully (e.g. "the bare species' generation 4 evolved a fitter descendant that crushed the earlier run"). Audit every public-facing string. Includes site-wide consistency check: same word for same concept everywhere. Logo + favicon refresh if needed. Drop any remaining "GAD+emergent" framing per decision gad-166 and treat findings as articles/whitepapers per decision gad-169.

## Definition of Done

1. `/planning` route content fully redistributed into `/projects/[id]` tabs — the `/planning` route either redirects or shows a cross-project dashboard
2. Every Planning*Tab component accepts a `projectId` prop and fetches per-project data via `eval-data-access.cjs` or `/api/dev/evals/` routes
3. `/projects/[...id]` detail page has new tabs: Planning (tasks, decisions, roadmap, requirements, notes), Evolution (workflows, skill candidates), System (stats, runtime)
4. Landing page for each project shows workflow visualizations, human review scores, top stats, findings as whitepapers
5. Zero occurrences of banned vocabulary in public-facing strings: "eval project" (→ Species), "run"/"version" (→ Generation), "GAD+emergent", "emergent" as product name
6. Type ramp refreshed with clear hierarchy across project/species/generation levels
7. Art of War epigraphs present on key section headers
8. Logo/favicon updated to evolutionary theme
9. `npm run build` passes with zero new type errors
10. All new components have `data-cid` attributes per VCS contract

## Tasks

### Wave 1: Route scaffolding + data wiring (parallelizable)

These tasks create the new route structure and data plumbing. No cross-dependencies within the wave.

#### Task 45-01: Project detail tab shell — add tabbed navigation to `/projects/[...id]`

- **Goal:** Add a client-side tab bar to the project detail page with tabs: Overview (current content), Planning, Evolution, System. Default to Overview. Tab selection stored in URL search param `?tab=`.
- **Files:**
  - `site/app/projects/[...id]/page.tsx` — add tab bar wrapper
  - `site/app/projects/[...id]/ProjectDetailTabs.tsx` — new client component for tab navigation
  - `site/app/projects/[...id]/ProjectDetailTabContent.tsx` — new client component for conditional rendering
- **Verify:** `cd site && npx tsc --noEmit` passes; visiting `/projects/grime-time` shows tab bar with 4 tabs; clicking Planning tab shows placeholder
- **Depends:** none

#### Task 45-02: Per-project data adapter — server component data loader for planning tabs

- **Goal:** Create a server-side data loader that reads planning XML files for a given project via `eval-data-access.cjs` and the existing `build-site-data.mjs` patterns. Returns tasks, decisions, roadmap phases, requirements, and notes as typed props.
- **Files:**
  - `site/app/projects/[...id]/project-planning-data.ts` — new server module: `loadProjectPlanningData(projectId: string)`
  - `site/lib/planning-xml-reader.ts` — new module to parse `.planning/` XML files for arbitrary project roots (extends patterns from `build-site-data.mjs`)
- **Verify:** Import and call `loadProjectPlanningData("get-anything-done")` from a test script or server component; confirm it returns non-empty arrays for tasks, decisions, phases
- **Depends:** none

#### Task 45-03: Per-project API routes for planning data

- **Goal:** Add REST endpoints that serve per-project planning data for client-side fetching. Extends the existing `/api/dev/evals/` route tree.
- **Files:**
  - `site/app/api/dev/evals/projects/[id]/planning/route.ts` — GET returns `{ tasks, decisions, phases, requirements, notes }` for the project
  - `site/app/api/dev/evals/projects/[id]/system/route.ts` — GET returns `{ stats, recentActivity }` from self-eval.json and trace data
- **Verify:** `curl http://localhost:3000/api/dev/evals/projects/get-anything-done/planning` returns JSON with non-empty arrays
- **Depends:** none

#### Task 45-04: Vocabulary constants file

- **Goal:** Create a single-source vocabulary mapping file that all components import. Maps internal terms to display terms per decisions gad-166, gad-169, gad-189.
- **Files:**
  - `site/lib/vocabulary.ts` — exports `VOCAB` object: `{ evalProject: "Species", run: "Generation", version: "Generation", brood: "Brood", recipe: "Recipe", dna: "DNA", findings: "Articles", emergent: null (banned) }`
- **Verify:** `npx tsc --noEmit` passes; grep for the file being importable
- **Depends:** none

#### Task 45-05: Art of War epigraph registry

- **Goal:** Create a curated set of Art of War quotes mapped to section contexts (hero, planning, evolution, system, findings, scoring). Each entry has the original quote, a rewritten variant keyed to the evolutionary model, and the section it applies to.
- **Files:**
  - `site/lib/epigraphs.ts` — exports `EPIGRAPHS` array with `{ section, original, adapted, attribution }` entries; export `getEpigraph(section: string)` helper
- **Verify:** `npx tsc --noEmit` passes
- **Depends:** none

### Wave 2: Component migration (depends on Wave 1)

Redistribute existing `/planning` components to project-scoped rendering.

#### Task 45-06: Migrate PlanningTasksTab to project-scoped

- **Goal:** Refactor `PlanningTasksTab` to accept `projectId` prop. Data comes from the Wave 1 data adapter instead of global generated TS. Move or copy to project detail scope.
- **Files:**
  - `site/app/projects/[...id]/ProjectPlanningTasksTab.tsx` — new file adapted from `site/app/planning/PlanningTasksTab.tsx`
  - `site/app/projects/[...id]/ProjectDetailTabContent.tsx` — wire into Planning tab
- **Verify:** Navigate to `/projects/get-anything-done?tab=planning`; tasks render with data from GAD's own `.planning/TASK-REGISTRY.xml`
- **Depends:** 45-01, 45-02

#### Task 45-07: Migrate PlanningDecisionsTab to project-scoped

- **Goal:** Same pattern as 45-06 for decisions.
- **Files:**
  - `site/app/projects/[...id]/ProjectPlanningDecisionsTab.tsx` — adapted from `PlanningDecisionsTab.tsx` + `PlanningDecisionsSection.tsx`
- **Verify:** Decisions render under Planning tab for a project with `.planning/DECISIONS.xml`
- **Depends:** 45-01, 45-02

#### Task 45-08: Migrate PlanningRoadmapTab + GanttSection to project-scoped

- **Goal:** Roadmap tab with Gantt timeline scoped to one project's phases.
- **Files:**
  - `site/app/projects/[...id]/ProjectPlanningRoadmapTab.tsx` — adapted from `PlanningRoadmapTab.tsx` + `PlanningGanttSection.tsx`
- **Verify:** Roadmap phases and Gantt bars render for the target project
- **Depends:** 45-01, 45-02

#### Task 45-09: Migrate PlanningRequirementsTab + PlanningNotesTab to project-scoped

- **Goal:** Requirements and notes views scoped to project.
- **Files:**
  - `site/app/projects/[...id]/ProjectPlanningRequirementsTab.tsx`
  - `site/app/projects/[...id]/ProjectPlanningNotesTab.tsx`
- **Verify:** Both subtabs render under Planning tab
- **Depends:** 45-01, 45-02

#### Task 45-10: Migrate Evolution tab components to project-scoped

- **Goal:** PlanningWorkflowsTab (agent split band, signal/human workflows, discovery panels) and PlanningSkillCandidatesTab become per-project Evolution tab content.
- **Files:**
  - `site/app/projects/[...id]/ProjectEvolutionTab.tsx` — combines workflow + skill candidate views
  - Adapts from `PlanningWorkflowsTab.tsx`, `PlanningSkillCandidatesTab.tsx`, `PlanningSkillCandidateCard.tsx`, `PlanningSkillCandidatesHeader.tsx`
- **Verify:** Evolution tab shows workflow diagrams and skill candidates for the project
- **Depends:** 45-01, 45-02

#### Task 45-11: Migrate System tab components to project-scoped

- **Goal:** PlanningSystemStatCards + PlanningSystemRuntimeActivityPanel become per-project System tab fed by that project's self-eval.json and trace data. Extends command bridge for live data.
- **Files:**
  - `site/app/projects/[...id]/ProjectSystemTab.tsx` — combines stat cards + runtime activity
  - Adapts from `PlanningSystemTab.tsx`, `PlanningSystemStatCards.tsx`, `PlanningSystemRuntimeActivityPanel.tsx`
- **Verify:** System tab renders stat cards; in dev mode, runtime activity panel streams data
- **Depends:** 45-01, 45-03

#### Task 45-12: Rewire /planning route — redirect or cross-project dashboard

- **Goal:** Replace the monolithic `/planning` page. Option A: redirect to `/projects` with planning context. Option B: lightweight dashboard that links to each project's Planning tab. Choose based on what feels natural — the content now lives per-project.
- **Files:**
  - `site/app/planning/page.tsx` — rewrite to dashboard or redirect
  - `site/app/planning/PlanningTabbedContent.tsx` — remove or simplify (tab content now per-project)
- **Verify:** Visiting `/planning` either redirects or shows project links; no broken imports
- **Depends:** 45-06 through 45-11

### Wave 3: Visual rebrand + copy pass

#### Task 45-13: Landing page composition — workflow graphs + metrics + findings

- **Goal:** The project detail Overview tab becomes the "landing page" for each project. Add: marketing-grade workflow visualization (using existing visualization primitives), human review scores, top stats (files, skills, tool mix), findings rendered as article/whitepaper cards. VCS showcase section demonstrating the Visual Context System flow.
- **Files:**
  - `site/app/projects/[...id]/ProjectHeroSection.tsx` — rewrite hero with evolutionary language + Art of War epigraph
  - `site/app/projects/[...id]/ProjectWorkflowShowcase.tsx` — new marketing-grade workflow diagram
  - `site/app/projects/[...id]/ProjectFindingsSection.tsx` — restyle findings as whitepaper/article cards
  - `site/app/projects/[...id]/ProjectStatsBar.tsx` — new compact stats bar (files, skills, tool mix, generations)
- **Verify:** Project detail page Overview tab looks like a marketing landing page; workflow viz renders; findings styled as articles
- **Depends:** 45-01

#### Task 45-14: Type ramp + color palette refresh

- **Goal:** Refresh the type hierarchy for clarity across project/species/generation levels. Compact for editor views, expanded for landing/marketing views. Keep dark theme + existing accent system. Layer evolutionary visual language: growth gradients, generation dots as DNA base pairs, timeline-as-phylogeny.
- **Files:**
  - `site/app/globals.css` or `site/tailwind.config.ts` — type ramp variables, new gradient utilities
  - `site/components/ui/` — any shared typography primitives that need updating
- **Verify:** Visual inspection of project detail page; type sizes clearly differentiate project > species > generation; gradient accents visible
- **Depends:** none (can start parallel with Wave 2)

#### Task 45-15: Vocabulary audit — full string sweep

- **Goal:** Find and replace all banned vocabulary in public-facing components. Use the `VOCAB` constants from 45-04. Systematic grep + replace across all `site/` TSX/TS files.
- **Files:**
  - All files under `site/app/` and `site/components/` containing banned terms
  - Target strings: "eval project" → "Species", "run" (in eval context) → "Generation", "version" (in eval context) → "Generation", "GAD+emergent" → remove, "emergent" (as product name) → remove
- **Verify:** `grep -ri "eval.project\|GAD+emergent" site/app/ site/components/` returns zero hits in user-facing strings (data identifiers in code are fine)
- **Depends:** 45-04

#### Task 45-16: Hero copy rewrite + Art of War epigraphs

- **Goal:** Rewrite the main hero section and all section headers with evolutionary language. Insert Art of War epigraphs from 45-05 registry on key section dividers. Make the site read playfully.
- **Files:**
  - `site/app/projects/[...id]/ProjectHeroSection.tsx` — hero copy
  - `site/app/projects/[...id]/ProjectFindingsSection.tsx` — section header + epigraph
  - `site/app/projects/[...id]/ProjectRunsSection.tsx` — section header + epigraph
  - `site/app/projects/[...id]/ProjectSkillsScopeSection.tsx` — section header + epigraph
  - `site/components/site/` — any shared section headers
- **Verify:** Visual inspection; hero reads with evolutionary metaphor; at least 3 section epigraphs visible
- **Depends:** 45-05, 45-13

#### Task 45-17: Logo + favicon refresh

- **Goal:** Design and implement an evolutionary-themed logo (helix, phylogeny tree, or similar). Update favicon, OG image, and any logo references.
- **Files:**
  - `site/public/favicon.ico` (or `.svg`)
  - `site/public/og-image.png`
  - `site/app/layout.tsx` — metadata references
  - `site/components/site/` — any logo component
- **Verify:** Favicon visible in browser tab; OG image updated; `npm run build` passes
- **Depends:** none

### Wave 4: Verification + cleanup

#### Task 45-18: /project-market integration — marketplace links to project landing pages

- **Goal:** Ensure `/project-market` cards link to the new project detail with tabs. Verify published/draft filter still works. Each card leads to the project's Overview (landing page) tab.
- **Files:**
  - `site/app/project-market/` — verify card links
  - `site/app/projects/[...id]/page.tsx` — ensure Overview tab is default
- **Verify:** Click a project card on `/project-market`; lands on project detail Overview tab with marketing content
- **Depends:** 45-13

#### Task 45-19: Dead import cleanup — remove unused /planning imports

- **Goal:** After redistribution, clean up any dead imports, unused components, and orphaned files in `site/app/planning/`. If `/planning` became a redirect, remove components that are fully superseded by project-scoped versions.
- **Files:**
  - `site/app/planning/*.tsx` — audit each file; remove if fully migrated
  - `site/app/projects/[...id]/*.tsx` — verify no broken imports
- **Verify:** `cd site && npx tsc --noEmit` passes with zero errors; no unused imports warnings
- **Depends:** 45-12

#### Task 45-20: Full build + VCS audit

- **Goal:** Run full build, verify all `data-cid` attributes present on new components, run VCS grep to confirm every new section is discoverable.
- **Files:**
  - All new components from this phase
- **Verify:** `cd site && npm run build` succeeds; `grep -r "data-cid" site/app/projects/` shows cids on all new sections; no type errors
- **Depends:** 45-19

#### Task 45-21: README + external docs copy pass

- **Goal:** Update README.md, any About page, and external-facing docs to use evolutionary vocabulary consistently. Drop "GAD+emergent" framing. Treat findings as articles/whitepapers in all copy.
- **Files:**
  - `README.md` at repo root
  - `site/app/` — any About or info pages
  - `site/content/` — any MDX docs referencing old vocabulary
- **Verify:** `grep -ri "GAD+emergent\|eval.project" README.md site/content/` returns zero user-facing hits
- **Depends:** 45-15

---

## Risk Notes

- **Planning XML parsing**: Wave 1 task 45-02 requires parsing `.planning/` XML for arbitrary projects. Pattern exists in `build-site-data.mjs` but may need generalization.
- **Component size**: Wave 2 migrations (45-06 through 45-11) are mechanical but each touches 1-3 files. Keep commits atomic.
- **Vocabulary audit scope**: Task 45-15 may surface terms in generated data files — only fix user-facing strings, not internal identifiers.
