---
name: prefer-clean-baseline-over-custom-dev-runtime-for-benchmark
description: >-
  Mark benchmark validity as degraded when runtime version is custom
  dev build; prefer clean tagged baseline for cross-runtime
  comparisons. Addresses environment pressure 8 for opencode x
  benchmark tasks.
status: stable
workflow: workflows/prefer-clean-baseline-over-custom-dev-runtime-for-benchmark.md
---

Before running cross-runtime benchmarks, check each runtime's version.
Mark runtimes with custom/dev builds as "degraded" validity and
prefer clean tagged baseline releases for fair comparison. Ensures
benchmark results are reproducible and comparable.

**Workflow:** See [workflow.md](./workflow.md) for version checking,
validity tagging, and benchmark matrix preferences.

## Provenance

Drafted from
`.planning/candidates/prefer-clean-baseline-over-custom-dev-runtime-for-benchmark/CANDIDATE.md`
(2026-05-05). Environment pressure: 8 for opencode x benchmark.
See PROVENANCE.md for full audit trail.
