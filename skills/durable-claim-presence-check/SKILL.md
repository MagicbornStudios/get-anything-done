---
status: stable
workflow: workflows/durable-claim-presence-check.md
description: Handoff claim records must carry durable agent identity and a lease; orphan-reclaim sweeper enforces the invariant
triggers:
  - claim-leak detection
  - multi-agent coordination
  - designing work queues
  - handoff stuck in claimed state
---

# Durable Claim Presence Check

## When to use
Any time you design or review handoff claim records, work queue claim schemas, or multi-agent coordination patterns. The `claimed_by` field must be a structured object, not a free-form string.

## Why this matters
Free-form `claimed_by` strings provide no way to verify whether the claiming agent is still alive (GLOBAL-D-333). When agents crash, restart, or get rate-limited, claims persist indefinitely with no reclaim path. The operator invariant — `claimed_count <= live_workers + live_external_agents` — breaks silently and the queue appears busy while no work happens. Durable identity fields plus a lease-based sweeper enforce the invariant automatically.

## Triggers
- "claim-leak detection"
- "handoffs stuck in claimed state"
- "designing work queue claim schema"
- "multi-agent coordination"
- "orphan claim reclaim"

## Success criteria
- Every claim record has: `agent_id`, `runtime`, `worker_id`, `session_id`, `parent_agent_id`, `claim_lease_until`
- Sweeper runs on schedule and reclaims expired leases
- `claimed_count <= live_workers + live_external_agents` invariant holds
- Free-form string `claimed_by` rejected at write time

## Anti-patterns
- `claimed_by: "codex-worker-3"` — bare string, no schema, no lease
- Claim without `claim_lease_until` — no expiry, no reclaim path
- Sweeper exists but isn't running (or only runs on-demand)
- Invariant only checked manually during incidents

## See also
- GLOBAL-D-333
- `.planning/team/runtime-cooldown.json` (live runtime state)
- `.planning/ERRORS-AND-ATTEMPTS.xml` (claim-leak incident entries)
