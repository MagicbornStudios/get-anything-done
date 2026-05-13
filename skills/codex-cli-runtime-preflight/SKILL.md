---
name: codex-cli-runtime-preflight
description: >-
  Before selecting codex-cli for test-repair tasks, run runtime
  health/auth preflight and exclude when unhealthy. Addresses
  environment pressure 15 with 0% success rate and 3 auth_failures.
status: stable
workflow: workflows/codex-cli-runtime-preflight.md
---

Before dispatching codex-cli for test-repair tasks, run a runtime
health and auth preflight. Check installation, run
`gad runtime check`, and run a smoke prompt. Exclude codex-cli from
dispatch when unhealthy and route to fallback runtime.

**Workflow:** See [workflow.md](./workflow.md) for preflight steps,
exclusion logic, and fallback routing.

## Provenance

Drafted from
`.planning/candidates/environment-bootstrap-skill-codex-cli-test-repair-environment-pressure/CANDIDATE.md`
(2026-05-05). Environment pressure: 15, 3 auth_failures over 3 runs.
See PROVENANCE.md for full audit trail.
