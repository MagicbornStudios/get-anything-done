---
name: opencode-runtime-preflight
description: >-
  Before selecting opencode for test-repair tasks, run runtime
  health/auth preflight and exclude when unhealthy. Addresses
  environment pressure 12 with 0% success rate.
status: stable
workflow: workflows/opencode-runtime-preflight.md
---

Before dispatching opencode for test-repair tasks, run a runtime
health and auth preflight. Check installation, run
`gad runtime check`, and run a smoke prompt. Exclude opencode from
dispatch when unhealthy and route to fallback runtime.

**Workflow:** See [workflow.md](./workflow.md) for preflight steps,
exclusion logic, and fallback routing.

## Provenance

Drafted from
`.planning/candidates/environment-bootstrap-skill-opencode-test-repair-environment-pressure/CANDIDATE.md`
(2026-05-05). Environment pressure: 12, 0% success over 3 runs.
See PROVENANCE.md for full audit trail.
