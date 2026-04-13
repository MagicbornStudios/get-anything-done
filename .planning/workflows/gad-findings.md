---
slug: gad-findings
name: GAD Findings Authoring
description: Experiment → raw results → surprise identification → whitepaper writeup → publish. Findings are articles/whitepapers documenting what we tried, what we learned, and what changed in the architecture as a result.
trigger: An experiment completes (eval round, framework change, research pass) AND produced a result that is surprising, counter-intuitive, or load-bearing for a decision.
participants:
  skills: []
  agents: [default]
  cli: [gad eval verify, gad eval report]
  artifacts: [vendor/get-anything-done/evals/FINDINGS-YYYY-MM-DD-<slug>.md, site/lib/catalog.generated.ts, site/app/findings/[slug]/page.tsx]
parent-workflow: gad-loop
related-phases: [42.2, 42.3]
---

Findings are the public whitepaper output of the GAD research loop
(decision gad-169). Each finding documents one experiment: what the
hypothesis was, what we ran, what the raw results showed, what was
surprising, and what architectural change it drove (or failed to).

The "surprise identification" step is load-bearing. A finding that
just summarizes a result nobody doubted is not worth publishing.
Findings earn their place by changing someone's mental model — the
framework's, the operator's, or a future reader's.

After the writeup lands in `evals/FINDINGS-YYYY-MM-DD-<slug>.md`,
`build-site-data.mjs` picks it up into the FINDINGS catalog and both
`/findings` (index) and `/findings/[slug]` (detail) start rendering
it. Related surfaces (rubric, run hero callouts, phase 45 hero copy)
link to it directly.

```mermaid
flowchart LR
  A[experiment runs] --> B[capture raw results + metrics]
  B --> C[identify what is surprising]
  C --> D{worth a finding?}
  D -->|no| E[log in .planning/notes/ only]
  D -->|yes| F[draft FINDINGS-YYYY-MM-DD-<slug>.md]
  F --> G[hypothesis, evidence, interpretation, architectural impact]
  G --> H[commit finding file]
  H --> I[build-site-data picks up into FINDINGS catalog]
  I --> J[/findings index + /findings/[slug] render]
  J --> K[link from related site surfaces]
```
