---
slug: gad-loop
name: GAD Loop
description: The main GAD execution loop — snapshot for context, pick one planned task, implement, update planning artifacts with required attribution, commit. The atomic unit of forward progress.
trigger: Start of any working session, or after completing the previous task in a phase.
participants:
  skills: [check-todos, task-checkpoint, gad-next]
  agents: [default]
  cli: [gad snapshot, gad tasks, gad state]
  artifacts: [.planning/TASK-REGISTRY.xml, .planning/STATE.xml, .planning/DECISIONS.xml]
related-phases: [42.3]
---

The canonical loop defined in CLAUDE.md and AGENTS.md: hydrate context
with `gad snapshot`, pick one `planned` task from TASK-REGISTRY.xml,
implement it, update the task's `status="done"` along with the mandatory
`skill` / `agent` / `type` attribution (decision gad-104), update
STATE.xml's next-action via `gad state set-next-action --projectid <id> "<text>"`
(hard cap 600 chars — pointer not journal), record any new decisions in
DECISIONS.xml using the `gad-NNN` format, and commit.

The attribution step is load-bearing. Without it the self-eval pipeline
has no data to compute `workflow_conformance` against (decision gad-173).
Skipping attribution is the single biggest source of trace gaps in the
measured reality (gad-162 baseline: 4 / 179 = 2.2% fully attributed).

**Operator-facing output during this loop follows the GAD communication
style** — see `references/communication-style.md`. SITREP tone, root set
once, tables for structured state, deltas only, no trailing summaries.
This is the default for every GAD project.

```mermaid
flowchart TD
  A[gad snapshot --projectid X] --> B[check-todos skill]
  B --> C[pick one planned task]
  C --> D[implement task]
  D --> E[task-checkpoint skill: verify planning docs updated]
  E --> F[TASK-REGISTRY.xml: status=done + skill + agent + type]
  F --> G[STATE.xml next-action updated]
  G --> H{new decisions?}
  H -->|yes| I[DECISIONS.xml: gad-NNN entry]
  H -->|no| J[commit]
  I --> J
  J --> K{more tasks queued?}
  K -->|yes| C
  K -->|no| L[end session or gad-next]
```
