---
status: stable
workflow: workflows/gad-cli-over-file-foraging.md
description: Reach for gad ask or any gad <subcommand> before Glob+Read+Grep cascades on planning data
triggers:
  - seeking GAD ecosystem state
  - questions about decisions/tasks/errors/handoffs
  - planning data lookup
  - architecture history query
---

# GAD CLI Over File Foraging

## When to use
Any time you need to answer a question about the GAD ecosystem: current tasks, past decisions, error history, handoff state, phase progress. The CLI is the cheap path. Glob+Read+Grep cascades on `.planning/` XML files are the expensive path that provides the same data with more context cost.

## Why this matters
`gad ask` uses MoE routing against the planning corpus. `gad decisions list` parses DECISION-REGISTRY.xml and returns structured data. `gad snapshot` gives full state in one call. Agents that skip the CLI and manually Glob `.planning/` are consuming 3-10× more context tokens for the same answer, and often miss data that the CLI aggregates from multiple sources. Today's gad-ask MoE design makes the cheap path even cheaper — use it.

## Triggers
- "what decisions exist about X"
- "what tasks are in phase N"
- "what errors have been logged"
- "what's the handoff state"
- "looking up planning data"

## Success criteria
- First attempt at any planning-data question uses `gad <subcommand>` or `gad ask`
- Glob+Read+Grep on `.planning/` only when CLI doesn't cover the use case
- Raw XML reads replaced by structured CLI output

## Anti-patterns
- Opening TASK-REGISTRY.xml to check task status instead of `gad tasks list`
- Grep on DECISION-REGISTRY.xml instead of `gad decisions list --projectid <id>`
- Multi-file Read cascade on `.planning/` for something `gad snapshot` provides
- Not trying `gad ask` for general ecosystem questions

## See also
- `gad ask --help` (MoE routing)
- `gad snapshot --projectid <id>` (full state in one call)
- CLAUDE.md CLI quick reference table
