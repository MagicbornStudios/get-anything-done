# XP Math — Skill-weighted XP accumulation and level thresholds

> Phase 127 decision record. Deterministic, replayable XP computation from task-stamp history.

## Core formula

```
xp = sum(skill_weight[task.skill]) for task in done_tasks_with_stamp
```

XP is the sum of skill-weight values for every task that has been stamped `status=done` with a `skill` attribute. Cancelled, failed, or un-stamped tasks contribute 0.

## Skill weight table

Weights are tiered by the leverage and complexity of the skill:

| Tier | Weight | Description | Examples |
|---|---|---|---|
| Atomic | 1 | Single-purpose, low-complexity skills that perform one narrow operation | find-skills, gad-add-todo, gad-note, gad-settings, gad-help, gad-stats, gad-update, gad-health, gad-check-todos, gad-workspace-show, gad-workspace-add, gad-workspace-sync, gad-task-checkpoint, gad-add-tests |
| Implementation | 3 | Multi-step skills that produce non-trivial code or analysis | frontend-design, gad-debug, gad-plan-phase, gad-discuss-phase, gad-verify-work, gad-verify-phase, gad-validate-phase, gad-docs-update, gad-write-feature-doc, gad-write-tech-doc, gad-write-intent, gad-research-phase, gad-review, gad-forensics, gad-map-codebase, web-design-guidelines, shadcn, npm-package, self-eval, trace-analysis |
| Workflow | 5 | Process-level skills that orchestrate a phase or multi-file change | gad-execute-phase, gad-cross-config-domain-change, gad-autonomous, gad-progress, gad-next, gad-do, gad-reapply-patches, gad-review-backlog, gad-session-report, consolidate-cli-and-routes, framework-upgrade, monorepo-rename-and-relocate, move-route-with-deprecation-stub, scaffold-tauri-desktop-shell, scaffold-clerk-operator-attribution, scaffold-visual-context-surface, verify-clean-clone-site-build |
| Compound / Orchestration | 8 | Meta-level skills that generate, evolve, or bootstrap entire systems | gad-evolution-evolve, gad-new-project, gad-new-milestone, gad-complete-milestone, gad-audit-milestone, gad-milestone-summary, gad-plan-milestone-gaps, gad-audit-uat, gad-visual-context-system, gad-skill-creator, create-skill, create-proto-skill, merge-skill, find-skills, eval-skill-install, objective-eval-design, portfolio-sync, gad-manuscript, gad-manager, gad-handoffs, gad-generate-spawn, tui-track-slice-coordination, wire-agents-md-context-bootstrap, wire-byok-encrypted-env, wire-skill-provenance-tracking |

### Unrecognized skills

If a task carries a `skill` stamp that does not match any entry in this table, the default weight is **1** (atomic floor). This ensures unrecognized attribution still counts but never over-credits.

## Level threshold curve

```
xp_to_next(L) = 100 * L^1.5
```

Where L is the current level. The curve is super-linear so each level costs more than the last, but the exponent 1.5 keeps it achievable (not exponential).

### First 10 levels — worked example

| From Level | To Level | xp_to_next | Cumulative XP to reach |
|---|---|---|---|
| 1 | 2 | 100 | 100 |
| 2 | 3 | 283 | 383 |
| 3 | 4 | 520 | 903 |
| 4 | 5 | 800 | 1703 |
| 5 | 6 | 1118 | 2821 |
| 6 | 7 | 1470 | 4291 |
| 7 | 8 | 1852 | 6143 |
| 8 | 9 | 2263 | 8406 |
| 9 | 10 | 2700 | 11106 |
| 10 | 11 | 3162 | 14268 |

### Example calculation

A project at level 3 with 420 XP:
- xp_to_next(3) = 100 * 3^1.5 = 100 * 5.196 = 520 (rounded)
- Remaining to next: 520 - 420 = 100 XP
- Status: climbing

A project at level 1 with 100 XP:
- xp_to_next(1) = 100 * 1^1.5 = 100
- Remaining to next: 100 - 100 = 0 XP
- Status: level-up ready (run `gad evolution level-up`)

## Why these weights

The tiered weight system reflects the **selection pressure** model from GAD's evolution loop: skills that resolve high-pressure phases (the compound/orchestration tier) should contribute more to the team's level than atomic housekeeping. This mirrors the intuition that shipping a `gad-evolution-evolve` cycle (which reshapes the species DNA) is worth more XP than running `gad-add-todo` (which captures a single idea).

The exponent 1.5 in the threshold curve was chosen so that:
- Level 1->2 is reachable after a single productive phase (a few done tasks = ~50-150 XP).
- Level 5 requires sustained work across many phases (~1700 XP), which maps to a mature project.
- The curve never feels impossible — it grows steadily but the XP inflow from done tasks also grows as the project accumulates more skills and more phases.

## Edge cases

- **Cancelled / failed tasks**: 0 weight regardless of skill. Only `status=done` stamps count.
- **Re-stamping**: idempotent. The `<stamped-tasks/>` list in STATE.xml tracks which task IDs have already contributed XP; re-stamping the same task is a no-op.
- **Handoff closeouts with skill stamp**: same weight as a task stamp. The handoff completion event is treated as an implicit done task for the attributed skill.
- **Backfill (`gad species recalculate-xp`)**: resets XP to the deterministic sum of all done+stamped task weights from scratch. Safe to run any time; produces identical result on re-run.
- **Level-up does not auto-advance**: when accumulated XP >= xp_to_next, the CLI emits a notice. The operator (or agent) must explicitly run `gad evolution level-up` to advance the level counter and reset overflow.
