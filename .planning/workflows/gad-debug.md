---
slug: gad-debug
name: GAD Debug
description: Scientific-method debugging — gather symptoms, form hypotheses, test to eliminate, confirm root cause, fix or hand off. State persists across context resets via .planning/debug/<slug>.md so the investigation survives compaction.
trigger: A bug report, test failure, unexpected behavior, or an in-phase task that fails with a non-obvious cause.
participants:
  skills: [debug, gad-debug]
  agents: [default, gad-debugger]
  cli: [gad state]
  artifacts: [.planning/debug/<slug>.md]
parent-workflow: gad-discuss-plan-execute
related-phases: [42.3]
---

The GAD debug loop turns debugging into a persisted, resumable
investigation. A `.planning/debug/<slug>.md` file captures symptoms,
hypotheses, investigation log, and root cause as the agent works. If
the session compacts or crashes mid-investigation, the file is
enough to rehydrate the state and continue — no lost hypotheses,
no re-discovered dead ends.

The value of the workflow is the disciplined hypothesis step. Without
it the agent will guess at random fixes. With it, the agent is forced
to name the thing it's testing before testing it, which both speeds up
elimination and makes the investigation log useful to a human later.

```mermaid
flowchart TD
  A[symptom reported] --> B[debug skill activates]
  B --> C{existing debug session?}
  C -->|yes| D[resume .planning/debug/<slug>.md]
  C -->|no| E[gather symptoms: expected, actual, repro, timeline, prior attempts]
  E --> F[write .planning/debug/<slug>.md]
  D --> G[gad-debug skill: form or refine hypotheses]
  F --> G
  G --> H[pick one hypothesis to test]
  H --> I[run minimal test]
  I --> J{hypothesis confirmed?}
  J -->|no| K[eliminate, log reason]
  J -->|yes| L[confirm root cause]
  K --> G
  L --> M[fix OR hand off with full investigation log]
  M --> N[mark session resolved]
```
