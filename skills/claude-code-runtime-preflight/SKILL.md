---
name: claude-code-runtime-preflight
description: >-
  Before selecting claude-code for planning or test-repair tasks, run
  runtime health/auth preflight and exclude when unhealthy. Addresses
  environment pressure 28 (planning) and 104 (test-repair) with 0%
  success rates.
status: stable
workflow: workflows/claude-code-runtime-preflight.md
---

Before dispatching claude-code for planning or test-repair tasks, run a
runtime health and auth preflight. Check installation, run
`gad runtime check`, and optionally run a smoke prompt for planning
tasks. Exclude claude-code from dispatch when unhealthy and route to
fallback runtime.

**Workflow:** See [workflow.md](./workflow.md) for preflight steps,
exclusion logic, and fallback routing.

## Provenance

Drafted from
`.planning/candidates/environment-bootstrap-skill-claude-code-planning-environment-pressure/CANDIDATE.md`
and
`.planning/candidates/environment-bootstrap-skill-claude-code-test-repair-environment-pressure/CANDIDATE.md`
(2026-05-05). Combined environment pressures: 28 (planning) + 104
(test-repair). See PROVENANCE.md for full audit trail.
