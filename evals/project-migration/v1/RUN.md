# Run v1 — project-migration (repo-planner)

**Date:** 2026-04-04  
**GAD version:** 1.32.0  
**Project migrated:** `vendor/repo-planner`  
**Status:** completed

## Migration steps performed

- [x] Added `[[planning.roots]]` entry in `.planning/planning-config.toml` (id=repo-planner, path=vendor/repo-planner)
- [x] Added `docs_sink` to planning config pointing at `apps/portfolio/content/docs`
- [x] Created `vendor/repo-planner/.planning/ROADMAP.md` (checklist format, 6 done + 1 planned)
- [x] Created `vendor/repo-planner/.planning/STATE.md` (plain key-value format)
- [x] Created `vendor/repo-planner/.planning/AGENTS.md` (GAD context re-hydration + docs sink ref)
- [x] Migrated `rp-manuscript` content → `vendor/get-anything-done/skills/manuscript/SKILL.md`
- [x] Replaced rp-manuscript SKILL.md with deprecation stub
- [x] Created `vendor/get-anything-done/skills/README.md` with full rp-* → gad:* mapping

## CLI output after migration

### gad state --json
```json
[
  {
    "project": "repo-planner",
    "phase": "7/7",
    "milestone": "gad-migration-01",
    "status": "active",
    "open tasks": "—",
    "last activity": "2026-04-04"
  }
]
```

### gad phases (repo-planner rows)
```
repo-planner  1   done     Phase 1: Portfolio integration baseline
repo-planner  2   done     Phase 2: Package host contract
repo-planner  3   done     Phase 3: Live cockpit
repo-planner  4   done     Phase 4: Built-in planning-pack generation
repo-planner  5   done     Phase 5: Workflow loop
repo-planner  6   done     Phase 6: Structured cockpit views
repo-planner  7   planned  Phase 7: GAD migration
```

## Metric scores

| Metric | Score | Notes |
|--------|-------|-------|
| planning_continuity | 0.90 | All phases preserved; tasks not yet in TASK-REGISTRY.md (repo-planner uses portfolio docs sink) |
| skill_coverage | 0.95 | All rp-* deprecated; manuscript fully migrated; catalog complete |
| context_efficiency | 0.85 | Phase, milestone, status, last_activity all return values; open_tasks "—" (no TASK-REGISTRY in .planning) |
| docs_sink_alignment | 0.80 | Sink docs exist and are current; not yet updated to reference GAD migration phase |

## Gaps to address in v2

1. `open_tasks` returns "—" — repo-planner uses portfolio docs task-registry.mdx, not a local XML file. Need TASK-REGISTRY.md in `.planning/` or cross-reference to sink.
2. Docs sink state file should note the GAD migration phase status
3. Other rp-* skills (rp-add-todo, rp-check-todos, etc.) have deprecation stubs but no actual content migration — they reference GSD workflows. Should have canonical SKILL.md files in `vendor/get-anything-done/skills/`.
