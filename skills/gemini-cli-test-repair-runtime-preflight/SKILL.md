---
name: gemini-cli-test-repair-runtime-preflight
description: >-
  Before selecting gemini-cli for test-repair tasks, run runtime
  health/auth preflight and exclude when unhealthy. Addresses
  environment pressure 15 with 0% success rate over 3 runs.
status: stable
workflow: workflows/gemini-cli-test-repair-runtime-preflight.md
---

Before dispatching gemini-cli for test-repair tasks, run a runtime
health and auth preflight. Check installation, verify auth mode,
and run a smoke prompt. Exclude gemini-cli from test-repair dispatch
when unhealthy and route to fallback runtime.

**Workflow:** See [workflow.md](./workflow.md) for preflight steps,
exclusion logic, and fallback routing.

## Provenance

Drafted from
`.planning/candidates/environment-bootstrap-skill-gemini-cli-test-repair-environment-pressure/CANDIDATE.md`
(2026-05-05). Environment pressure: 15, 0% success over 3 runs.
See PROVENANCE.md for full audit trail.
