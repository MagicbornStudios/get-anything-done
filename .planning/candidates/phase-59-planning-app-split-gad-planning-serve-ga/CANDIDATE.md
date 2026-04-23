---
status: candidate
source_phase: "59"
source_phase_title: "Planning-app split + gad planning serve + gad start daily entry"
pressure_score: 53.91
tasks_total: 11
tasks_done: 11
crosscuts: 9
created_on: "2026-04-23"
created_by: compute-self-eval
---

# Candidate from phase 59

## Phase

```
get-anything-done | 59 | Planning-app split + gad planning serve + gad start daily entry
selection pressure: 53.91  (11 tasks, 11 done, 9 crosscuts)
```

## Tasks

```
59-01 done Scaffold apps/planning-app/ as a new Next 15 workspace entry. Minimal shell: layout.tsx with dev-only auth stub, home page redirecting to /my-projects, tailwind config mirroring the landing app, tsconfig paths. Runs on a distinct dev port (3002) so it coexists with the landing app during migration.
59-02 done Extract shared UI primitives into a consumable location. Candidates: MarketingShell (rename to AppShell with slot-based navigation), SectionEpigraph, SiteSection, SiteProse. Options: (a) packages/ui-shared workspace package, (b) direct imports from vendor/get-anything-done/site/components/site/ with a re-export barrel. Pick (b) initially — faster, defer package extraction until a third consumer emerges.
59-03 done Port /planning route from landing app to planning-app. All existing tabs (Tasks, Decisions, Requirements, Notes, Workflows, SkillCandidates, System) move intact. Data source stays the same — planning CLI readers via gad binary or direct XML parse. Landing app's /planning stays for one release cycle with a deprecation banner.
59-04 done Port /projects routes + build the /my-projects dashboard. Dashboard shows: list of owned projects with phase/next-action snippet, per-project drawer (current phase, open tasks, recent decisions, subagent-run history, BYOK env status), action buttons (trigger daily subagent, view last report, open planning XML). Consumes gad CLI readers. Lives on planning-app only — landing gets a redirect banner.
59-05 done Implement 'gad planning serve' CLI subcommand. Spawns planning-app (next dev in dev / next start in prod) on port 3002 with reuse detection — if something is already listening on the port and responds with a planning-app health endpoint, attach rather than spawn. Logs go to ~/.gad/logs/planning-app-&lt;date&gt;.jsonl. Graceful shutdown on SIGINT.
59-06 done Implement 'gad start' CLI subcommand (decision gad-262). Runs 'gad planning serve' if not running, waits for health, opens browser to http://localhost:3002/my-projects. Aliased as 'gad dashboard'. Idempotent. --no-browser flag skips the browser open for editor/iframe workflows.
59-07 done Daily-subagent dispatch hook. 'gad start' (or an explicit 'gad start --dispatch-subagents') reads each project config for daily-subagent: true and, if today's run has not yet been recorded in .planning/subagent-runs/&lt;projectid&gt;/, spawns the configured subagent runtime with the project snapshot + task context. Writes run record on completion (consumes subagent-run-history todo schema).
59-08 done Deprecate landing-site /planning and /projects routes with redirect stubs — server-rendered page that says 'this view moved to gad planning serve' with copy-pasteable install+run commands. Keep for one release cycle then remove. Update all internal cross-links to /my-projects.
59-09 done Render subagent-run history on /my-projects project drawer. Reads .planning/subagent-runs/&lt;projectid&gt;/*.json (schema from todo 2026-04-17-subagent-run-history.md). Timeline view — date, task id, status, one-line outcome, link to full report body, link to teaching tip produced. Empty state with a 'trigger a run' button.
59-10 done CLI efficiency gap cluster: land task-registry writer + gad tasks add + gad tasks promote + gad tasks --stalled + gad next. Closes the hand-editing loop that forced agents to edit TASK-REGISTRY.xml by hand to register new tasks (root cause of the 45-todo backlog in vendor/get-anything-done/.planning/todos/ never becoming real tasks). New lib/task-registry-writer.cjs: pure addTaskToXml + atomic appendTaskToFile, fs-injectable for tests, stable error codes (TASK_ID_EXISTS, PHASE_NOT_FOUND, VALIDATION_FAILED, MALFORMED_XML, WRITE_FAILED). CLI subcommands under tasksV2Cmd: add (register by id/phase/goal), promote (lift a .planning/todos/*.md file into a task — filename derives id, first prose line becomes goal, todo moves to todos/promoted/ unless --keep). tasks list gains --stalled flag (in-progress tasks with no agent/skill/runtime attribution). New top-level gad next command: cross-project priority hotlist (tiers: active → stalled → next planned → idle). Tests: 16/16 in tests/task-registry-writer.test.cjs, all fs-injected, no real XML parser, no real disk. Also: operator-local gsd-* hooks deleted (gsd-check-update, gsd-context-monitor, gsd-prompt-guard, gsd-statusline, gsd-workflow-guard) + stale gsd-update-check.json cache + gsd-file-manifest.json — they were orphaned and surfacing /gsd:update prompts. Settings.json already points at gad-* siblings.
59-23 done Project Editor + dev API rehome from vendor/get-anything-done/site/ to apps/planning-app/. Pulls the entire `/projects/edit/[id]` tree (19 .tsx files: ProjectEditor, BestiaryTab, RecipesTab, ByokTab, InspectorPane, ProjectCanvas, DiffTree, GenerationRunner, RadarChart, TraitBar, DnaEditor, DnaActionRow, EditableField, InventoryGrid, LiveDataPanel, CommandPalette, PreviewFrame, page.tsx, use-command-bridge.ts) plus the supporting eval-data-runtime.ts loader and 8 of 16 `/api/dev/*` route trees actually used by the editor (command-bridge, env-defaults, evals/projects/*, gene-states, graph, live, scopes, secrets/*) into apps/planning-app. Vendor site keeps only marketing/landing surfaces.

Implementation: (1) tsconfig path `@gad-site/*` → `../../vendor/get-anything-done/site/*` so the editor still imports `eval-data` + `eval-data.generated` from the vendor site without copying the 19k-line generated file. (2) New apps/planning-app/lib/gad-paths.ts exports GAD_ROOT/GAD_LIB/GAD_BIN/GAD_SITE_DIR resolved via `import.meta.url` walk-up — replaces the original `process.cwd() + ".."` pattern that assumed cwd was the site dir. (3) scripts/rewrite-gad-paths.mjs (one-shot) sweeps all 19 copied files and substitutes the path-resolution patterns. (4) SiteSection ported into apps/planning-app/components/site/ as a stripped-down version (no dev-id band Visual Context Panel, no useDevId/BandDevPanel deps) so the public landing site can keep evolving its dev-id machinery without churning planning-app. (5) next.config.mjs sets outputFileTracingRoot to repo root + experimental.externalDir=true so Next traces the @gad-site imports cleanly. (6) Editor + dev API routes deleted from vendor site in the same change. Build verifies: pnpm --filter @portfolio/planning-app build succeeds with all 8 dev API routes + the editor route registered.

Vendor site `/projects/edit` and `/api/dev/*` routes are deleted in the same change. Captures decision-gad-269 boundary: vendor site = marketing/landing only; planning-app = operator surfaces (BYOK, evals, dev tooling).
```

## What this candidate is for

This file was auto-generated by `compute-self-eval.mjs` because phase
59 exceeded the selection pressure threshold. High pressure
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

The drafter writes to `.planning/proto-skills/phase-59-planning-app-split-gad-planning-serve-ga/SKILL.md` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in `skills/` as part of species DNA

The human reviewer runs `gad evolution promote <slug>` or
`gad evolution discard <slug>` after reviewing the proto-skill.
