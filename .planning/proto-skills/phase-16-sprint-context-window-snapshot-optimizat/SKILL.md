---
name: optimize-snapshot-token-budget
description: >-
  Cut `gad snapshot` token cost without dropping live signal. Apply four
  canonical cuts (sprint scope, drop cancelled, entity decode, active-only
  tasks) plus active-task file refs. Phase 16 baseline: 9,750 → 3,000
  tokens (3.25x). Use when snapshot exceeds the sprint context budget,
  before adding a new section, or when eval runs blame snapshot bloat.
status: proto
workflow: ./workflow.md
---

# optimize-snapshot-token-budget

Snapshot is the bootstrap surface — every cold agent reads it before the
first edit. When it bloats, every agent pays the cost. This skill is the
audit + trim + measure loop with a documented baseline (3.25x cut on
get-anything-done).

The four cuts are independent — apply whichever fit, measure between
each. The big wins come from sprint scope + dropping cancelled; entity
decode and active-only tasks tighten the residual.

**Workflow:** [./workflow.md](./workflow.md)

## Provenance

- Source candidate: `.planning/candidates/phase-16-sprint-context-window-snapshot-optimizat/CANDIDATE.md`
- Drafted: 2026-04-28 by `create-proto-skill`
- See [PROVENANCE.md](./PROVENANCE.md)
