---
id: h-2026-05-13T14-55-07-get-anything-done-63
projectid: get-anything-done
phase: 63
task_id: GAD-T-63-56
created_at: 2026-05-13T14:55:07.030Z
created_by: unknown
claimed_by: claude-code
claimed_at: 2026-05-13T17:02:02.249Z
completed_at: 2026-05-13T17:02:15.706Z
priority: normal
estimated_context: prescribed
risk: safe
time: standard
surface: local
runtime_preference: claude-code
runtime_fallbacks: ["codex-cli","gemini-cli"]
---
# Auto-close linked handoffs on task stamp

## Background
Workers stamp tasks done but forget the matching `gad handoffs complete`. As of 2026-05-13 the queue had 33 stale handoffs whose tasks were already done — closed via a manual sweep (monorepo commit 389a8c2f). Operator wants the gap fixed at the CLI utility level so no coding agent has to remember.

## Goal
Extend `bin/commands/tasks/stamp.cjs` (or wherever `gad tasks stamp` lives) so that when status flips to `done` or `cancelled`:
1. Scan `.planning/handoffs/open/` and `.planning/handoffs/claimed/` for files whose YAML frontmatter `task_id` matches the stamped task id.
2. For each match: append an `## Auto-closed` section to the body noting the task stamp event, then move the file to `.planning/handoffs/closed/` via `fs.renameSync` (preserves git history when followed by `git mv` semantics in the index).
3. Log each closure to `.planning/.gad-log/` per existing patterns.
4. Idempotent. Failure to close one handoff doesn't block the stamp.

## Out of scope
- Auto-reopen on un-stamp (status flipped back to planned). Operator can handle manually if it happens.
- Cross-project task_id matching. Scope to the same project.
- Closing handoffs whose task_id is null/missing — leave those for the sweep tool.

## Acceptance gate
- [x] `bin/commands/tasks/stamp.cjs` (or equivalent) updated; before-flip and after-flip behaviors covered.
- [x] Unit test: stamp a task that has an open handoff -> handoff moved to closed, body has Auto-closed section.
- [x] Unit test: stamp a task with no linked handoff -> no error, no spurious files.
- [x] Unit test: stamp a task whose handoff is already in closed/ -> idempotent, no error.
- [x] CHANGELOG entry under vendor/get-anything-done/.
- [x] One short note in monorepo CLAUDE.md under the loop section: 'Task stamp now auto-closes linked handoffs.'

## Completed

Implemented by claude-code on 2026-05-13.

Files changed:
- `bin/commands/tasks/stamp.cjs` — added `autoCloseLinkedHandoffs()` called after successful stamp when status=done|cancelled; exported for test isolation.
- `tests/tasks-stamp-auto-close-handoffs.test.cjs` — 6 unit tests covering all acceptance gate cases.
- `CHANGELOG.md` — [Unreleased] entry added.
- `CLAUDE.md` (monorepo root) — loop step 4 note added.