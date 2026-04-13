---
slug: gad-decide
name: GAD Decide
description: Structured decision pattern — open question from the user, agent gathers options, writes pros/cons, recommends with rationale, user accepts or redirects, commit to DECISIONS.xml.
trigger: User asks an open question with multiple viable answers that deserves a recorded decision ("should we X or Y?", "what's the best way to Z?").
participants:
  skills: []
  agents: [default]
  cli: []
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
  A[user asks open question] --> B[agent gathers viable options]
  B --> C[agent writes structured pros/cons per option]
  C --> D[agent names recommendation + rationale]
  D --> E{user accepts?}
  E -->|yes| F[add entry to DECISIONS.xml]
  E -->|redirect| B
  E -->|defer| G[capture as open question in STATE.xml]
  F --> H[update STATE.xml next-action if queue changed]
  G --> H
  H --> I[commit]
```
