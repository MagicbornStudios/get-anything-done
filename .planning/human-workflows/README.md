# Human workflows

Hand-authored descriptions of what the **human operator** does at the
keyboard — daily routines, sit-down-to-work procedures, review gates, and
similar "meatspace" procedures. These are NOT agent workflows.

## How this differs from `.planning/workflows/`

| Aspect | `.planning/workflows/` (agent) | `.planning/human-workflows/` (human) |
|---|---|---|
| Subject | AI agent's expected skill / agent / CLI graph | Operator's expected sequence of actions |
| Trace-matched? | Yes — conformance score from `.trace-events.jsonl` | No — no trace pipeline matches these |
| Frontmatter | `participants`, `trigger`, `parent-workflow`, `origin` | `operator`, `frequency`, `triggers`, `projects-touched` |
| Mermaid | Required (parser skips files without it) | Optional — body is mostly prose |
| Surface | Planning → Workflows tab | Planning → Human Workflows tab |

Agent workflows describe what a model is expected to do when invoked.
Human workflows describe what the operator is expected to do when they sit
down at the monorepo root. Keep them separate: merging them would confuse
trace matching and dilute both surfaces.

## Authoring

Each file is a Markdown doc with YAML frontmatter. Required fields:

- `slug` — stable id, usually same as filename
- `name` — human-readable title
- `operator` — always `human` (reserved for future `pair` / `team` values)
- `frequency` — `daily`, `weekly`, `on-demand`, etc.
- `triggers` — list of situations that kick off this workflow
- `projects-touched` — list of GAD project ids the workflow touches
- `related-phases` — list of related planning phase ids

The body is free-form prose describing the procedure. A `flowchart LR`
Mermaid block is encouraged but optional.

## Why this exists

Expectation mismatches between the operator and the planning docs (e.g.
"I didn't expect tasks to land in the global `.planning/`") should show up
as explicit workflow gaps, not tribal knowledge. Eventually these will be
cross-referenced against trace data (task 44-21) to detect when an observed
session diverges from the expected human routine.
