---
slug: gad-evolution
name: GAD Evolution Loop
description: Pressure → candidate → proto-skill → validated → promoted/discarded. The mechanism by which GAD's skill set evolves from observed high-pressure phases into new distributable skills.
trigger: `compute-self-eval` detects a phase with high pressure metrics (tool-use burst, repeated corrections, long loops, novel failure patterns), OR an operator manually runs `gad evolution` against pending candidates.
participants:
  skills: [create-proto-skill, gad-evolution-evolve, gad-evolution-validator, gad-skill-creator]
  agents: [default]
  cli: [gad evolution status, gad evolution validate, gad evolution promote, gad evolution discard]
  artifacts: [skills/candidates/<slug>/CANDIDATE.md, skills/proto-skills/<slug>/PROVENANCE.md, skills/proto-skills/<slug>/SKILL.md, skills/proto-skills/<slug>/VALIDATION.md, sdk/skills/<name>/]
parent-workflow: gad-loop
related-phases: [42, 42.2, 42.3]
---

GAD's self-improvement loop. Pressure in a phase is a signal that some
repeatable pattern is missing from the skill set; the evolution loop
turns that signal into a distributable skill over three stages.

Stage 1 is automatic (compute-self-eval writes raw CANDIDATE.md). Stage 2
is agentic (the `create-proto-skill` skill drafts in bulk with per-
candidate checkpoints per decision gad-171, then `gad-evolution-validator`
writes VALIDATION.md advisorily). Stage 3 is human — review and decide
promote-or-discard. The loop gates on zero pending proto-skills so
humans stay in the approval path.

Proto-skill is a permanent type (decision gad-167): PROVENANCE.md
travels with the skill through promotion so we can triage by pressure
origin forever.

```mermaid
flowchart TD
  A[compute-self-eval detects pressure] --> B[write skills/candidates/<slug>/CANDIDATE.md]
  B --> C[gad-evolution-evolve skill orchestrates]
  C --> D[create-proto-skill skill: bulk draft]
  D --> E[write PROVENANCE.md lock marker]
  E --> F[draft SKILL.md in dot-agent format]
  F --> G[gad-evolution-validator skill: VALIDATION.md advisory]
  G --> H[human review SKILL.md + VALIDATION.md]
  H --> I{promote?}
  I -->|yes| J[gad evolution promote -> sdk/skills/<name>/]
  I -->|no| K[gad evolution discard]
  J --> L[PROVENANCE.md travels with skill]
```
