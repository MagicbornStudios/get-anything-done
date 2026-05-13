---
name: claude-code-test-repair-runtime-preflight
description: >-
  Before selecting claude-code for test-repair tasks, run runtime
  health/auth preflight and exclude when unhealthy. Addresses
  environment pressure 104 with 0% success rate over 26 runs.
status: stable
workflow: workflows/claude-code-test-repair-runtime-preflight.md
---

Before dispatching claude-code for test-repair tasks, run a runtime
health and auth preflight. Check installation, run
`gad runtime check`, and run a smoke prompt. Exclude claude-code from
test-repair dispatch when unhealthy and route to fallback runtime.

**Workflow:** See [workflow.md](./workflow.md) for preflight steps,
exclusion logic, and fallback routing.

## Provenance

Drafted from
`.planning/candidates/environment-bootstrap-skill-claude-code-test-repair-environment-pressure/CANDIDATE.md`
(2026-05-05). Environment pressure: 104, 0% success over 26 runs.
See PROVENANCE.md for full audit trail.
