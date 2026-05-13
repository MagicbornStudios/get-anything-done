---
status: stable
workflow: workflows/phase-task-skill-attribution-discipline.md
description: Every task close must stamp the skill that closed it so the curator can assign training weight
triggers:
  - closing a task
  - stamping task done
  - phase completion review
  - attribution audit
---

# Phase Task Skill Attribution Discipline

## When to use
Every time you close a task. No exceptions. The `--skill` flag on `gad tasks stamp` is required, not optional. Also use during phase reviews to audit and retroactively fill gaps.

## Why this matters
The training-data curator weights examples by attributed skill. Tasks closed without `--skill` are invisible to the model improvement pipeline — the system cannot learn which skills produced which outcomes. Scan of phases 10-14 found N done tasks with zero attributed skills, creating a blind spot in the entire training signal for those phases.

## Triggers
- "closing a task"
- "stamping task done"
- "phase completion review"
- "tasks list shows null skill"
- "attribution audit before phase close"

## Success criteria
- `gad tasks stamp` call always includes `--skill <slug>`
- Phase review grep for `"skill": null` returns 0 results
- Retroactive stamps applied before moving to the next phase

## Anti-patterns
- Stamping without `--skill` because the task felt trivial
- Batching attribution fills to "later" — later never comes
- Using a generic slug like `gad-do` when a more specific skill was actually applied
- Skipping attribution on bug fixes or refactors (these are training-valuable)

## See also
- GAD-D-104 (attribution mandate)
- `memory/feedback_task_files_array_discipline.md` (parallel files[] discipline)
- `.planning/.evolution-scan.json` (scan source)
