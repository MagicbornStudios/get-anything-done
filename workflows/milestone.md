# Milestone Lifecycle — Router

This is a thin umbrella workflow. All methodology lives in the per-verb sub-skills; `gad:milestone` dispatches to them by subcommand.

## Dispatch

| Subcommand | Route to | Purpose |
|---|---|---|
| `gad:milestone --audit` | [gad:audit-milestone](../skills/gad-audit-milestone/SKILL.md) | Pre-close integrity check — requirements coverage + cross-phase verification |
| `gad:milestone --close` | [gad:complete-milestone](../skills/gad-complete-milestone/SKILL.md) | Archive milestone, tag release, reset STATE for next cycle |
| `gad:milestone --new` | [gad:new-milestone](../skills/gad-new-milestone/SKILL.md) | Start a new milestone cycle — questioning + requirements + roadmap |
| `gad:milestone --plan-gaps` | [gad:plan-milestone-gaps](../skills/gad-plan-milestone-gaps/SKILL.md) | Create phases to close gaps identified by an audit |
| `gad:milestone --summary` | [gad:milestone-summary](../skills/gad-milestone-summary/SKILL.md) | Generate onboarding summary from milestone artifacts |

## Mode inference (if no explicit flag)

Read STATE.md + ROADMAP.md; pick by signal:

- All/most phases `done`, no audit artifact → `--audit`
- Audit artifact present with `status: passed` → `--close`
- Last milestone archived, no active phases → `--new`
- Audit artifact present with `status: gaps_found` → `--plan-gaps`

Delegate to the matching sub-skill. Do not carry methodology here — per decision gad-190 the umbrella is a thin router; sub-skill workflow files are the single source of truth for procedure.
