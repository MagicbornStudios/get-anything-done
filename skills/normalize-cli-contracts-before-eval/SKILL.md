---
name: normalize-cli-contracts-before-eval
description: >-
  All cross-runtime evaluations must run through
  adapter-normalized input/output contracts and normalized error codes
  before scoring. Addresses routing pressure 10 for all x eval
  tasks (58 runs, 0% success).
status: stable
workflow: workflows/normalize-cli-contracts-before-eval.md
---

Before running cross-runtime evaluations, normalize all input/output
contracts and error codes through adapters. This ensures scoring
reflects actual runtime performance rather than contract mismatches
or error code differences between runtimes.

**Workflow:** See [workflow.md](./workflow.md) for normalization
steps, error code mapping, and verification before scoring.

## Provenance

Drafted from
`.planning/candidates/normalize-cli-contracts-before-eval/CANDIDATE.md`
(2026-05-05). Routing pressure: 10 for all x eval (58 runs).
See PROVENANCE.md for full audit trail.
