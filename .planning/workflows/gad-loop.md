---
slug: gad-loop
name: GAD Loop
description: The main GAD execution loop — snapshot for context, pick one planned task, implement, update planning artifacts with required attribution, commit. The atomic unit of forward progress.
trigger: Start of any working session, or after completing the previous task in a phase.
participants:
  skills: []
  agents: [default]
  cli: [gad snapshot, gad tasks]
  artifacts: [.planning/TASK-REGISTRY.xml, .planning/STATE.xml, .planning/DECISIONS.xml]
related-phases: [42.3]
---

The canonical loop defined in CLAUDE.md and AGENTS.md: hydrate context
with `gad snapshot`, pick one `planned` task from TASK-REGISTRY.xml,
implement it, update the task's `status="done"` along with the mandatory
`skill` / `agent` / `type` attribution (decision gad-104), update
STATE.xml's next-action, record any new decisions in DECISIONS.xml using
the `gad-NNN` format, and commit.

The attribution step is load-bearing. Without it the self-eval pipeline
has no data to compute `framework_compliance` (and soon
`workflow_conformance`) against. Skipping attribution is the single
biggest source of trace gaps in the measured reality (gad-162
measurement: 4 / 179 = 2.2% fully attributed).

```mermaid
flowchart TD
  A[gad snapshot --projectid X] --> B[read state + task queue]
  B --> C[pick one planned task]
  C --> D[implement]
  D --> E[update task: status=done, skill, agent, type]
  E --> F[update STATE.xml next-action]
  F --> G{new decisions?}
  G -->|yes| H[add gad-NNN to DECISIONS.xml]
  G -->|no| I[commit]
  H --> I
  I --> J{more tasks queued?}
  J -->|yes| C
  J -->|no| K[end session or plan next phase]
```
