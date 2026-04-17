# CLI gap: shipped — keep in backlog as reference

**Source:** session 2026-04-17 strategy pivot

Shipped in session 2026-04-17.

Before this session, `gad` had no way to durably insert a new decision, phase, or todo. List commands existed but no writers.

## What was shipped

- lib/decisions-writer.cjs — writeDecision(root, baseDir, {...})
- lib/roadmap-writer.cjs  — writePhase(root, baseDir, {...})
- lib/todos-writer.cjs    — writeTodo(root, baseDir, {...})
- gad.cjs wires new subcommands:
  - gad decisions add <id> --title --summary [--impact --date --refs]
  - gad phases add <id> --title --goal [--status --depends --milestone]
  - gad todos add <slug> --title --body [--source --date]
- Backward-compat injectDefaults: bare `gad phases` / `decisions` / `todos` still list.

## Next extensions (not shipped)

- `gad decisions edit <id>` / `gad phases edit <id>` — mutate existing entries
- `gad decisions remove <id>` — for test cleanup + rare corrections
- `gad phases add --before <id>` — insert not-append (for urgent gap phases)
- Task-registry writer (new task add)
