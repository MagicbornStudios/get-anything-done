# Requirements: Project Migration Eval

## Goal

Measure the quality and completeness of migrating a project from a legacy planning framework (RepoPlanner XML-based) to GAD. This eval documents the repeatable migration pattern so it can be applied across all projects in the monorepo.

## What "migrated" means

A project is fully migrated when:

1. **Registered as a GAD root** — entry in `planning-config.toml` `[[planning.roots]]`
2. **GAD planning files present** — `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/AGENTS.md`
3. **`gad state` returns clean data** — no "—" for milestone, status, or phase
4. **`gad phases` returns correct done/active** — phases match actual completion state
5. **`gad tasks` works** — returns tasks from TASK-REGISTRY.xml or STATE.md tables
6. **Skills migrated** — rp-* skills replaced by gad:* equivalents; no orphaned methodology
7. **Docs sink aligned** — portfolio planning docs reference the GAD project, not legacy XML paths
8. **No planning drift** — legacy session.md replaced by gad session

## Metrics

| Metric | Definition |
|--------|------------|
| planning_continuity | All planning state preserved across migration (phase history, decisions, tasks) |
| skill_coverage | Every rp-* skill has a gad:* equivalent; no methodology lost |
| context_efficiency | `gad state` + `gad context` returns useful output for this project (no "—" fields) |
| docs_sink_alignment | Portfolio docs still accurately describe the project after migration |

## Scoring per metric

**planning_continuity (0–1):**
- 1.0: All phases, tasks, decisions, and errors-and-attempts preserved
- 0.8: Phases + tasks preserved; decisions moved without loss
- 0.6: Phases preserved; tasks partially migrated
- <0.6: Data loss

**skill_coverage (0–1):**
- 1.0: All rp-* skills have documented gad:* equivalents; manuscript migrated
- 0.8: Core workflow skills migrated (execute, plan, verify, session)
- 0.5: Partial migration; some skills still only rp-* with no gad equivalent

**context_efficiency (0–1):**
- 1.0: `gad state` returns phase, milestone, status, open_tasks, last_activity, next_action
- 0.8: Phase, milestone, status present; minor gaps
- <0.6: Major gaps ("—" on critical fields)

**docs_sink_alignment (0–1):**
- 1.0: Sink docs reference GAD project; state in sink matches STATE.md
- 0.8: Sink docs exist but not updated for GAD migration phase
- 0.5: Sink docs stale (refer to legacy XML paths or old status)

## Success criteria

- All four metrics >= 0.80
- Composite score >= 0.85
- `gad projects list` shows the project
- No rp-* skills without a corresponding gad:* stub

## Baseline project: repo-planner

The first migration documented in this eval is `vendor/repo-planner`. Run the measurement after migration completes to establish the v1 baseline.

## Repeatable pattern checklist

For each new project migration:
- [ ] Add `[[planning.roots]]` entry to `planning-config.toml`
- [ ] Create `.planning/ROADMAP.md` (checklist format)
- [ ] Create `.planning/STATE.md` (plain key-value, not table format)
- [ ] Create `.planning/AGENTS.md` (GAD context re-hydration + docs sink reference)
- [ ] Run `gad state --projectid <id>` — verify no "—" on critical fields
- [ ] Run `gad phases --projectid <id>` — verify done/active correct
- [ ] Update docs sink state file with GAD migration phase status
- [ ] Replace any legacy skill stubs with gad:* redirects
