---
slug: gad-decide
name: GAD Decide
description: Structured decision pattern — open question from the user, agent gathers options, writes pros/cons, recommends with rationale, user accepts or redirects, commit to DECISIONS.xml.
trigger: User asks an open question with multiple viable answers that deserves a recorded decision ("should we X or Y?", "what's the best way to Z?").
participants:
  skills: [gad-list-phase-assumptions]
  agents: [default]
  cli: [gad decisions]
  artifacts: [.planning/DECISIONS.xml, .planning/STATE.xml]
parent-workflow: gad-discuss-plan-execute
related-phases: [42.3]
---

This is the pattern the user explicitly validated on 2026-04-14 when they
said "I like this so much I want this to be in our workflow." The agent
gathers candidate approaches, lays out pros and cons for each, names a
recommendation with reasoning, and waits for the user to accept, redirect,
or defer. Accepted recommendations become `<decision>` entries in
DECISIONS.xml with an id, title, summary, and impact. STATE.xml's
`next-action` is updated if the decision changes the queue.

Do NOT skip the pros/cons step. The value of the workflow is the
structured comparison, not the recommendation itself. A recommendation
without explicit tradeoffs is just an opinion, and the user loses the
ability to pressure-test it.

```mermaid
flowchart LR
  A[user asks open question] --> B[gather viable options]
  B --> C[gad-list-phase-assumptions skill: surface hidden constraints]
  C --> D[write structured pros/cons per option]
  D --> E[name recommendation + rationale]
  E --> F{user accepts?}
  F -->|yes| G[DECISIONS.xml: gad-NNN entry]
  F -->|redirect| B
  F -->|defer| H[STATE.xml: open question logged]
  G --> I[STATE.xml next-action updated]
  H --> I
  I --> J[commit]
```
