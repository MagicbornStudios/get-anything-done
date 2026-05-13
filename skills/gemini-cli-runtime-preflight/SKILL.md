---
name: gemini-cli-runtime-preflight
description: >-
  Before selecting gemini-cli for planning or test-repair tasks, run
  runtime health/auth preflight and exclude when unhealthy. Addresses
  environment pressure 30 (planning) and 15 (test-repair) with 0%
  success rates and 6 auth_failures.
status: stable
workflow: workflows/gemini-cli-runtime-preflight.md
---

Before dispatching gemini-cli for planning or test-repair tasks, run a
runtime health and auth preflight. Check installation, verify auth mode
(no interactive auth in headless), and run a smoke prompt. Exclude
gemini-cli from dispatch when unhealthy and route to fallback runtime.

**Workflow:** See [workflow.md](./workflow.md) for preflight steps,
exclusion logic, and fallback routing.

## Provenance

Drafted from
`.planning/candidates/environment-bootstrap-skill-gemini-cli-planning-environment-pressure/CANDIDATE.md`
and
`.planning/candidates/environment-bootstrap-skill-gemini-cli-test-repair-environment-pressure/CANDIDATE.md`
(2026-05-05). Combined environment pressures: 30 (planning) + 15
(test-repair), 6 auth_failures. See PROVENANCE.md for full audit trail.
