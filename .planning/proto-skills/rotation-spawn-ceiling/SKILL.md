---
status: proto
workflow: ./workflow.md
description: Three mandatory guards on any retry-rotation logic against premium APIs
triggers:
  - building rate-limit handlers
  - reviewing token-burn incidents
  - account-rotation logic
  - retry loop against premium API
---

# Rotation Spawn Ceiling

## When to use
Any time you implement or review retry-rotation logic that spawns against premium APIs (Anthropic, OpenAI, etc.) on rate-limit or transient failures. Three guards are non-negotiable.

## Why this matters
Uncapped rotation against premium APIs caused a token-burn incident (GLOBAL-D-331). Without a spawn ceiling, a single malformed work-unit can exhaust all accounts before the operator notices. Without a per-spawn cooldown check, parked runtimes get hammered on every rotation. Without `unclaim_history` entries, there is no audit trail and per-handoff filters cannot trip the circuit breaker.

## Triggers
- "building rate-limit handler"
- "account rotation logic"
- "retry loop against Anthropic/OpenAI"
- "token burn investigation"
- "rotation without recording retries"

## Success criteria
- `MAX_INNER_ROTATIONS = 3` constant defined and enforced before every spawn
- Cooldown check runs before spawn N and before every rotation spawn
- Every retry recorded as entry in `unclaim_history` on the handoff record
- Circuit breaker trips when `unclaim_history.length >= MAX_INNER_ROTATIONS`

## Anti-patterns
- Rotating accounts without recording each rotation as a retry in `unclaim_history`
- Checking cooldown only on first spawn, not on rotation spawns
- No hard ceiling — rotation continues until all accounts exhausted
- Using exit code alone to decide whether to rotate (doesn't catch parked-account cases)

## See also
- GLOBAL-D-331
- `.planning/team/runtime-cooldown.json`
- `.planning/ERRORS-AND-ATTEMPTS.xml` (token-burn entries)
