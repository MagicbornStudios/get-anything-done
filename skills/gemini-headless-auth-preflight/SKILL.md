---
name: gemini-headless-auth-preflight
description: >-
  Before selecting gemini-cli for headless execution, validate auth mode
  and run a smoke prompt; route to fallback runtime when auth preflight
  fails. Addresses 6 auth_failures, 0% success rate observed in
  gemini-cli x planning tasks.
status: stable
workflow: workflows/gemini-headless-auth-preflight.md
---

Before dispatching gemini-cli for headless planning or automation tasks,
run an auth preflight to avoid silent failures. Validate credentials exist,
run a smoke prompt to confirm end-to-end auth works, and route to a
fallback runtime (claude-code, opencode, codex-cli) when preflight fails.

**Workflow:** See [workflow.md](./workflow.md) for step-by-step preflight
procedure, fallback routing table, and failure-mode handling.

## Provenance

Drafted from
`.planning/candidates/gemini-headless-auth-preflight/CANDIDATE.md`
(2026-05-05). Source shows 6 auth_failures, 0% success rate for
gemini-cli x planning. See PROVENANCE.md for full audit trail.
