---
name: gad:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
workflow: workflows/verify-work.md
---
<objective>
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {phase_num}-UAT.md tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for /gad:execute-phase
</objective>

<execution_context>
@workflows/verify-work.md
@templates/UAT.md
</execution_context>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

Context files are resolved inside the workflow (`init verify-work`) and delegated via `<files_to_read>` blocks.
</context>

<graph_query_guidance>
Use `gad query` (decision gad-202) for targeted lookups instead of reading raw XML:
- `gad query "tasks done in phase <N>"` — find completed tasks to verify
- `gad query "decisions in phase <N>"` — check decisions that affect verification criteria
- `gad tasks --phase <N> --status done` — list tasks marked done in the phase
These are gated on `useGraphQuery=true` in gad-config.toml. If graph query is unavailable, fall back to reading `.planning/` XML directly.
</graph_query_guidance>

<process>
Execute the verify-work workflow from @workflows/verify-work.md end-to-end.
Preserve all workflow gates (session management, test presentation, diagnosis, fix planning, routing).
</process>
