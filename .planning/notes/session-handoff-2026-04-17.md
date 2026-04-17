# Session handoff — 2026-04-17

## Session window

Picked up from 2026-04-16d close (submodule `fef6d20`). Shipped through
submodule `34c06d8` + outer `7531a5e`. ~17 submodule commits + 5 outer
bumps in the session.

## Rehydration

1. Project: `get-anything-done` (the framework itself).
2. `node vendor/get-anything-done/bin/gad.cjs startup --projectid get-anything-done`
3. Read STATE.xml `<next-action>` for the live head-of-queue.
4. Read this note for the session context that doesn't fit in a one-liner.

## What shipped (tasks → status=done)

| Task | What |
|---|---|
| 42.4-21 (TRACK 3) | /how-it-works pressure live-example — renders real top-pressure phase (42.2, P=173.41) computed from `self-eval.json` |
| 45-04 | `site/lib/vocabulary.ts` — typed ENTITIES (8 entities × singular/plural/article), conditions, publication, sections, tabs, verbs, legacy-renamed, BANNED_TERMS, 5 helpers |
| 45-01 | ProjectDetailTabs now routes through `VOCAB.tabs`; Planning sub-tab persists via `?sub=`; data-cid per sub-tab button |
| 45-02 | `project-planning-data.ts` adapter now returns notes alongside tasks/decisions/phases/requirements/state |
| 45-07 + 45-08 | ProjectPlanningDecisionsTab + ProjectPlanningRoadmapTab wired into ProjectDetailTabContent (replaces "coming soon" placeholders) |
| 45-18 | Marketplace integration verified (card links → tab-shell; published filter active; empty-state renders). Stats-bar data-cid collision fixed via explicit `cidKey` prop |
| 45-05 | `site/lib/epigraphs.ts` expanded to 22 entries × 8 sections; typed `EpigraphSection`; 5 helpers including seeded `pickEpigraph` |
| 45-13 (pragmatic cut) | New `ProjectStatsBar` (generations/species/best-review/latest); Overview reordered Hero → StatsBar → Runs → Findings → Requirements → Skills → lineage → Bugs → Scoring. Workflow viz + VCS showcase deferred to a follow-up todo |
| 45-16 | New reusable `<SectionEpigraph>` component; 6 dividers on landing + 4 on project Overview; hero copy polish (roto→proto typo + evolutionary framing). **User subsequently revised the component to render original-quote first with adapted as "In our model" gloss** (see below). |

## Decisions added this session

| ID | Title |
|---|---|
| gad-226 | Planning artifacts are gauges — 4 gauge semantics (decisions/tasks/requirements/notes); roadmap deferred |
| gad-227 | Project listing visibility — public by default, `listingVisibility` per-project, moderation overrides owner |
| gad-228 | Multi-agent selector in editor — Claude Code / Codex / OpenCode via dropdown; runtime recorded on TRACE.json |
| gad-229 | Roadmap artifact demoted from gauge bank — 4 gauges committed, ROADMAP.xml stays as agent input |
| gad-230 | Visual identity palette — black-dominant, gold/maroon/red accents, gilded-shiny, non-typical, sleek |
| gad-231 | Adopt tweakcn as theme generator — customize fork path chosen (not hosted); shipped as TweakCN-OpenAI |
| gad-232 | VCS live showcase = three scripted client-side demos — move/remove/self-referential; character demo conditional |

Plus gad-225 was already there; operator also locked in the ROADMAP-shrink-later idea.

## Todos added (all parked)

- `planning-artifact-gauges` — four-gauge component family + sweet-spot config
- `listing-visibility-config` — per-project artifact toggles on project.json
- `moderation-tooling` — admin takedown/flag route
- `editor-agent-selector` — dropdown + detection + dev-server bridge runtime arg
- `2026-04-16-45-13-followup-workflow-vcs-showcase` — parent 45-13 deferred scope
- `shrink-roadmap-surface` — post-gauges, `{id,goal,deps}` only
- `tweakcn-integration` — **executed and shipped, kept as running-docs**
- `ai-asset-generation-pipeline` — `gad asset generate` for sprite/icon/bg/favicon/og/tileset/avatar
- `vcs-live-showcase-three-demos` — client-side demo band implementation

## Outside the GAD submodule

**TweakCN-OpenAI fork** — standalone. Not part of custom_portfolio, not a submodule.

- Location: `C:/Users/benja/Documents/tweakcn/` (sibling to `C:/Users/benja/Documents/custom_portfolio/`)
- Remote: `https://github.com/B2Gdevs/tweakcn` commit `23439d4`
- Package name: `tweakcn-openai`
- Strip: auth / DB / billing / ratelimit / community — all gutted
- Swap: Gemini → OpenAI (gpt-4o-mini / gpt-4o)
- Run: `pnpm install` → fill `OPENAI_API_KEY` in `.env.local` → `PORT=3010 pnpm dev` → open `/editor/theme`
- Build passes, dev probe confirmed

## Live state / gotchas next session needs to know

1. **tweakcn dev server may still be running** on port 3010 from my session (PID 58776). Can be killed manually or with a fresh system reboot. Not critical — just a port to watch.
2. **Outer commit 43e43b4 swept 26 pre-staged `rp-*` (repo-planner) deletions** up to main alongside a submodule bump. Pre-staged by someone else; if unintended, restore from before that commit. Already flagged to operator in session.
3. **Operator revised `SectionEpigraph` component** post-ship: shows the verbatim Sun Tzu quote as the hero line with attribution inline; `adapted` renders as a smaller muted "In our model" gloss underneath. The feedback driver was "no morphed quotes" — direct quotes first, our gloss second and clearly marked as ours. Don't revert this revision.
4. **Operator polished `LandingEvolutionBand`** (Shannon / Pressure block) — 2-col grid, dimension table, quote styling. Don't revert.
5. **Operator added `LandingEvolutionLoopBand`** to the landing `page.tsx` composition between EvolutionBand and GraphifyChaosBand. Check existence before touching that page.
6. Port conventions in this session: `3000` = GAD portfolio site dev, `3010` = tweakcn-openai dev, `3456` = `gad site serve` default (task 42.4-23).

## First actions for the next session

1. Startup + snapshot: `node vendor/get-anything-done/bin/gad.cjs startup --projectid get-anything-done` — save the session id.
2. Read STATE.xml `<next-action>`.
3. **If tweakcn first theme not yet generated**: operator generates a theme in `http://localhost:3010/editor/theme`, exports CSS, pastes into `site/app/globals.css`. Only then start 45-14.
4. **If tweakcn theme landed**: start 45-14 (type ramp + palette audit against the landed tokens; adjust `globals.css` deltas; verify across `/`, `/projects/[...id]`, `/project-market`).
5. **If user wants VCS demos**: start with `vcs-live-showcase-three-demos` todo — demos 2 + 3 (no sprite sheet required); demo 1 is conditional on easy client-side resolution.
6. **If user wants infra closure**: 45-03 (API route consolidation onto the 45-02 adapter), then 45-06 / 45-09 (task / requirements / notes migrations — small refactors since the components already fetch via the API route).
7. **If user wants to start capturing AI-generated assets**: `ai-asset-generation-pipeline` todo — design `gad asset generate <kind> <slug>` CLI surface with prompt templates baked to the gad-230 aesthetic.

## Pickup candidate list

Ordered by operator's stated preference (2026-04-16): 45 (wave 2) →
44.5 editor → 44 project-market wave 2 → TRACK 2 VCS portability spawn.

Within phase 45 still open: 45-03 API routes, 45-06 tasks migration,
45-09 requirements+notes migration, 45-10 Evolution tab components,
45-11 System tab components, 45-12 /planning rewire, 45-14 type+palette,
45-17 logo/favicon, 45-19 dead-import cleanup, 45-20 VCS audit+build,
45-21 README + external docs. 45-13 already landed (pragmatic cut),
follow-up exists. 45-16 already landed.

## What NOT to do

- Don't re-run full `gad snapshot` on every turn (decision gad-195). The
  session-id + active-mode downgrade is the discipline.
- Don't sweep unrelated pre-staged deletions into submodule-bump
  commits — always `git diff --cached --stat` before committing in the
  outer repo.
- Don't rewrite hero copy without operator confirmation. The "context
  under pressure" tagline is approved; small polish is ok, full rewrite
  is not.
- Don't morph Sun Tzu quotes into "adapted" versions that read as if
  they're the real thing. `SectionEpigraph` already enforces this
  (original-first, gloss-as-gloss) — preserve that structure.
