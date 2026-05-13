---
name: exclude-unhealthy-runtime-from-matrix
description: >-
  Any runtime failing install/auth/JSON contract precheck should be
  excluded from comparative matrix scoring and labeled blocked, not
  failed. Addresses 58 runs analyzed with 0% success for all x
  benchmark tasks.
status: stable
workflow: workflows/exclude-unhealthy-runtime-from-matrix.md
---

Before running cross-runtime benchmarks or eval matrices, precheck each
runtime's health. Runtimes that fail install, auth, or contract checks
are labeled "blocked" (excluded from scoring) rather than "failed"
(included but scored poorly). This keeps benchmark results clean and
actionable.

**Workflow:** See [workflow.md](./workflow.md) for precheck procedure,
matrix labeling, and blocked-vs-failed reporting.

## Provenance

Drafted from
`.planning/candidates/exclude-unhealthy-runtime-from-matrix/CANDIDATE.md`
(2026-05-05). Source shows 58 runs, 0% success for all x benchmark.
See PROVENANCE.md for full audit trail.
