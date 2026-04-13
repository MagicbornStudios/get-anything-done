---
slug: gad-debug
name: GAD Debug
description: Scientific-method debugging — gather symptoms, form hypotheses, test to eliminate, confirm root cause, fix or hand off. State persists across context resets via .planning/debug/<slug>.md so the investigation survives compaction.
trigger: A bug report, test failure, unexpected behavior, or an in-phase task that fails with a non-obvious cause.
participants:
  skills: [debug, gad-debug]
  agents: [default, gad-debugger]
  cli: []
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
  A[symptom reported] --> B{existing debug session?}
  B -->|yes| C[resume .planning/debug/<slug>.md]
  B -->|no| D[gather symptoms: expected, actual, repro, timeline, prior attempts]
  D --> E[write .planning/debug/<slug>.md]
  C --> F[form / refine hypotheses]
  E --> F
  F --> G[pick one hypothesis to test]
  G --> H[run minimal test]
  H --> I{hypothesis confirmed?}
  I -->|no| J[eliminate, log reason]
  I -->|yes| K[confirm root cause]
  J --> F
  K --> L[fix OR hand off with full investigation log]
  L --> M[mark session resolved]
```
