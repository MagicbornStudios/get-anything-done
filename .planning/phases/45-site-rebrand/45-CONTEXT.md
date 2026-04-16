# Phase 45: Full site rebrand — Context

**Gathered:** 2026-04-16 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the site from a single global /planning dashboard into a project-scoped template. Every GAD project ships with this site as its landing page + management surface. Visual rebrand around the evolutionary model (species/generation/DNA/brood). Redistribute /planning route content to per-project views. Drop remaining "GAD+emergent" framing. Treat findings as articles/whitepapers. Audit all public-facing strings for vocabulary consistency.

</domain>

<decisions>
## Implementation Decisions

### Route Restructuring
- **D-01:** /planning route content merges into /projects/[id] as project-scoped tabs. The /planning route itself becomes either a redirect to the first project or a top-level dashboard linking to all projects.
- **D-02:** Planning tab subtabs (tasks, decisions, roadmap, requirements, notes) become per-project views at /projects/[id]/planning or equivalent tabs within the project detail page.
- **D-03:** Evolution tab (workflows, skill candidates, proto-skills) moves to per-project scope — each project has its own evolution view showing its species' DNA state.
- **D-04:** System tab becomes per-project monitoring — real-time logging, token usage, session data for that project's agent runs. Reuses the command bridge pattern from the editor.

### Component Redistribution
- **D-05:** PlanningTasksTab, PlanningDecisionsTab, PlanningRoadmapTab, PlanningRequirementsTab, PlanningNotesTab — all move to project-scoped rendering. Data source changes from global generated TS to per-project data via eval-data-access.cjs or the /api/dev/evals/ routes.
- **D-06:** PlanningGanttSection — moves to per-project scope, shows that project's phase timeline.
- **D-07:** PlanningWorkflowsTab (agent split band, signal/human workflows, discovery panels) — per-project, showing that project's workflow patterns from its generation traces.
- **D-08:** PlanningSkillCandidatesTab — per-project, showing proto-skills and candidates from that project's .planning/ directory.
- **D-09:** PlanningSystemStatCards + PlanningSystemRuntimeActivityPanel — per-project, fed by that project's self-eval.json and trace data.
- **D-10:** Global system settings (if any) stay at a top-level /settings or /system route, not per-project.

### Landing Page Composition
- **D-11:** The distributable landing page for each project shows: workflow visualizations (marketing-grade), human review scores, top stats (files, skills, tool mix), findings as whitepapers/articles. This is the public face.
- **D-12:** /project-market remains the marketplace — shows published projects (per 44.5-01b draft/published model). Each project card links to its project detail (which IS the landing page).
- **D-13:** The sink compilation pipeline (already designed) produces the data each project's landing page consumes. All species and generations compile into sections.

### Visual Identity
- **D-14:** Keep dark theme + existing accent color system. Layer evolutionary/biological visual language on top: growth gradients, generation dots styled as DNA base pairs, timeline-as-phylogeny tree.
- **D-15:** Type ramp refresh: ensure hierarchy is clear across project/species/generation levels. Compact for editor views, expanded for landing/marketing views.
- **D-16:** All public-facing strings audited for vocabulary consistency: Species (not "eval project"), Generation (not "run" or "version"), Brood (accumulated generations), Recipe (template), DNA (skill configuration). Per decisions gad-166, gad-169, gad-189.
- **D-17:** Logo/favicon refresh if needed — evolutionary theme (helix, tree, or similar). Claude's discretion on specific design.

### Claude's Discretion
- Logo/favicon design specifics
- Exact color palette values (as long as dark theme + accent system preserved)
- Component layout details within project tabs (as long as content matches the redistribution decisions)
- Animation/transition choices for the evolutionary visual language

### Folded Todos
- **site-as-project-template** (from `.planning/todos/2026-04-16-site-as-project-template.md`): /planning route restructuring, component audit, requirements investigation, sprite system foundation
- **media-service-infra** items 3 (context battery bar — already shipped) and partially item 1 (media serving — foundation needed for landing page images)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `vendor/get-anything-done/.planning/DECISIONS.xml` — decisions gad-166 (drop GAD+emergent framing), gad-169 (findings as whitepapers), gad-189 (vocabulary lock), gad-206 (species = evolutionary branches)
- `vendor/get-anything-done/.planning/ROADMAP.xml` — phase 45 goal text
- `vendor/get-anything-done/.planning/todos/2026-04-16-site-as-project-template.md` — user's vision dump for this restructuring
- `vendor/get-anything-done/.planning/todos/2026-04-16-media-service-infra.md` — media/service infrastructure vision

### Current Components (to redistribute)
- `vendor/get-anything-done/site/app/planning/page.tsx` — current planning page
- `vendor/get-anything-done/site/app/planning/PlanningTabbedContent.tsx` — tab system
- `vendor/get-anything-done/site/app/planning/PlanningTasksTab.tsx` — tasks view
- `vendor/get-anything-done/site/app/planning/PlanningDecisionsTab.tsx` — decisions view
- `vendor/get-anything-done/site/app/planning/PlanningRoadmapTab.tsx` — roadmap view
- `vendor/get-anything-done/site/app/planning/PlanningRequirementsTab.tsx` — requirements view
- `vendor/get-anything-done/site/app/planning/PlanningNotesTab.tsx` — notes view
- `vendor/get-anything-done/site/app/planning/PlanningWorkflowsTab.tsx` — workflows view
- `vendor/get-anything-done/site/app/planning/PlanningSkillCandidatesTab.tsx` — skill candidates
- `vendor/get-anything-done/site/app/planning/PlanningSystemTab.tsx` — system stats
- `vendor/get-anything-done/site/app/planning/PlanningGanttSection.tsx` — gantt timeline

### Data Layer
- `vendor/get-anything-done/lib/eval-data-access.cjs` — CRUD module (project/species/generation/recipe)
- `vendor/get-anything-done/site/app/api/dev/evals/` — REST API routes
- `vendor/get-anything-done/site/scripts/build-site-data.mjs` — prebuild data generator

### Editor (integration points)
- `vendor/get-anything-done/site/app/projects/edit/[id]/ProjectEditor.tsx` — editor shell
- `vendor/get-anything-done/site/app/projects/edit/eval-data-runtime.ts` — runtime data adapter

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- All PlanningXxxTab components — refactor to accept projectId prop instead of reading global data
- eval-data-access.cjs — already provides per-project CRUD
- Command bridge (/api/dev/command-bridge) — can serve per-project real-time data
- PreviewFrame — device toggle iframe preview (44.5-10)
- InventoryGrid — config editing (44.5-05)
- BestiaryTab with search/filter — species browsing
- TraitBar, RadarChart, DiffTree — visualization primitives

### Established Patterns
- Project-scoped data via eval-data-access.cjs + REST API
- Server components load data, pass to client components as props
- SiteSection with data-cid for VCS integration
- Generated TS (eval-data.generated.ts) for static site, runtime adapter for dev

### Integration Points
- /projects/[...id] detail page — currently has Hero, Skills, Runs, Requirements, Findings, Bugs, Scoring sections
- /projects/edit/[id] — editor surface (already has planning tabs: DNA, Bestiary, Recipes)
- /project-market — marketplace listing (already filters by published)
- Sink compilation pipeline — compiles planning docs to docs_sink

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants workflow graphs as marketing-grade landing page content
- Evolution tab content is "pretty good to keep" — redistribute, don't rebuild
- Planning tab content (tasks, decisions, roadmap, requirements, notes) "should be belonging to all projects"
- System tab should make CLI requests for live data (extend command bridge pattern)
- "The site IS the product" — not a dashboard bolted on
- Species deck in editor center canvas needs to be the primary project management view
- Requirements not showing on /planning — needs investigation during implementation
- **VCS components should showcase the system flow** — the Visual Context System itself is a selling point, demonstrate it visually on the landing page
- **Art of War quotes** as design motif for the rebrand — strategic/evolutionary language, not corporate. "Know your enemy" → "Know your codebase." The evolutionary theme has a martial/strategic quality. Use sparingly as section epigraphs or hero copy.

</specifics>

<deferred>
## Deferred Ideas

- Sprite sheet generation system (standard prompts for Midjourney/DALL-E, immediately usable)
- API/token usage tracking with billing limits (service mode)
- Generation editing / self-mutation (Frankenstein mode)
- Recipe drag-and-drop into species deck
- WhatsApp/messaging agent integration
- Per-project repo integration (GitHub API)

### Reviewed Todos (not folded)
- media-service-infra items 2 (token tracking), 4 (generation editing), 5 (recipe drag-drop) — deferred to post-rebrand phase

</deferred>

---

*Phase: 45-site-rebrand*
*Context gathered: 2026-04-16*
