---
name: gad:plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
lane: dev
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text]"
agent: gad-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
workflow: workflows/gad-plan-phase.md
---
<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped), spawn gad-planner, verify with gad-plan-checker, iterate until pass or max iterations, present results.
</objective>

<execution_context>
@workflows/gad-plan-phase.md
@references/ui-brand.md
@references/sink-pipeline.md
</execution_context>

<planning_state_surface>
When editing ROADMAP / TASK-REGISTRY / DECISIONS as part of planning, hand-edit
the XML under `.planning/` — it is the source of truth. See the quick-reference
table in `@references/sink-pipeline.md` for the full "edit X → verify with Y"
map. Do NOT edit MDX in `docs/<id>/planning/`; that is a derived view.
</planning_state_surface>

<context>
Phase number: $ARGUMENTS (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop
- `--prd <file>` — Use a PRD/acceptance criteria file instead of discuss-phase. Parses requirements into CONTEXT.md automatically. Skips discuss-phase entirely.
- `--reviews` — Replan incorporating cross-AI review feedback from REVIEWS.md (produced by `/gad:review`)
- `--text` — Use plain-text numbered lists instead of TUI menus (required for `/rc` remote sessions)

Normalize phase input in step 2 before any directory lookups.
</context>

<graph_query_guidance>
Before planning, use `gad query` (decision gad-202) for targeted lookups instead of reading raw XML:
- `gad query "decisions citing phase <N>"` — find decisions relevant to this phase
- `gad query "tasks in phase <N>"` — check existing tasks before creating new ones
- `gad query "open tasks"` — understand current workload across phases
- `gad tasks --phase <N>` — concise task listing for the target phase
These are gated on `useGraphQuery=true` in gad-config.toml. If graph query is unavailable, fall back to reading `.planning/` XML directly.
</graph_query_guidance>

<process>
Execute the plan-phase workflow from @workflows/gad-plan-phase.md end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).
</process>
