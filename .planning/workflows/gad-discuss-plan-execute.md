---
slug: gad-discuss-plan-execute
name: GAD Discuss → Plan → Execute
description: The phase-level loop. Gather context and decisions in a discuss round, commit the design as a PLAN.md, then execute the plan's tasks atomically with per-task commits and attribution.
trigger: Start of a new phase, or resumption of a phase that has moved from `planned` to `active`.
participants:
  skills: [gad-discuss-phase, gad-plan-phase, gad-execute-phase, gad-verify-work]
  agents: [default, gad-planner, gad-executor]
  cli: [gad snapshot, gad state, gad tasks, gad decisions, gad verify]
  artifacts: [.planning/ROADMAP.xml, .planning/plans/<phase-id>/PLAN.md, .planning/TASK-REGISTRY.xml, .planning/STATE.xml, .planning/DECISIONS.xml]
parent-workflow: gad-loop
related-phases: [42.3]
---

The phase-level workflow that wraps the per-task `gad-loop`. Discuss
gathers the context and decisions needed to plan; plan writes the
task list to PLAN.md; execute runs the tasks one at a time through
`gad-loop` until the phase's definition-of-done is met. Each sub-round
is allowed to spawn `gad-decide` (for any open question) or `gad-debug`
(for any unexpected failure). The phase closes when `gad verify`
confirms the deliverables exist and the roadmap entry flips to `done`.

Do NOT skip discuss. A plan authored without the discuss round tends
to miss a decision that would have reshaped the task list.

```mermaid
flowchart TD
  A[operator names the phase] --> B[gad snapshot]
  B --> C[discuss round: gather context + assumptions]
  C --> D{open questions?}
  D -->|yes| E[spawn gad-decide per question]
  D -->|no| F[write PLAN.md + KICKOFF.md]
  E --> F
  F --> G[task loop: each task runs gad-loop]
  G --> H{failure?}
  H -->|yes| I[spawn gad-debug]
  H -->|no| J{more tasks?}
  I --> G
  J -->|yes| G
  J -->|no| K[gad verify — phase goal met?]
  K --> L[roadmap entry -> done, phase closeout commit]
```
