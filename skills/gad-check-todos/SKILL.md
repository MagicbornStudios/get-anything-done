---
name: gad:check-todos
description: List pending todos and select one to work on
argument-hint: [area filter]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
workflow: workflows/check-todos.md
---

<objective>
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action.

Routes to the check-todos workflow which handles:
- Todo counting and listing with area filtering
- Interactive selection with full context loading
- Roadmap correlation checking
- Action routing (work now, add to phase, brainstorm, create phase)
- STATE.md updates and git commits
</objective>

<execution_context>
@workflows/check-todos.md
</execution_context>

<context>
Arguments: $ARGUMENTS (optional area filter)

Todo state and roadmap correlation are loaded in-workflow using `init todos` and targeted reads.
</context>

<graph_query_guidance>
Use `gad query` (decision gad-202) for targeted lookups instead of reading raw XML:
- `gad query "open tasks"` — find all open/planned tasks across phases
- `gad query "tasks in phase <N>"` — scope to a specific phase
- `gad tasks --status planned` — list only planned tasks
These are gated on `useGraphQuery=true` in gad-config.toml. If graph query is unavailable, fall back to reading `.planning/` XML directly.
</graph_query_guidance>

<process>
**Follow the check-todos workflow** from `@workflows/check-todos.md`.

The workflow handles all logic including:
1. Todo existence checking
2. Area filtering
3. Interactive listing and selection
4. Full context loading with file summaries
5. Roadmap correlation checking
6. Action offering and execution
7. STATE.md updates
8. Git commits
</process>
