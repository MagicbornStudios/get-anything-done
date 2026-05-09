# Workflow: Durable Claim Presence Check

## Inputs
- Handoff claim record schema (existing or new)
- Worker/agent identity fields available at claim time
- Access to orphan-reclaim sweeper (or task to build one)

## Steps
1. **Enforce claim record schema**: every claim must carry: `agent_id`, `runtime`, `worker_id` (or null for external agents), `session_id`, `parent_agent_id` (or null), `claim_lease_until` (ISO timestamp).
2. **Set `claim_lease_until`**: default 30 minutes from claim time. Worker must renew lease on each heartbeat/iteration.
3. **Orphan-reclaim sweeper**: a background job (or pre-dispatch hook) scans claimed handoffs where `claim_lease_until < now`. These are orphans — reclaim them to open status.
4. **Invariant check**: before any new claim, verify `claimed_count <= live_workers + live_external_agents`. If invariant broken, run sweeper first.
5. **At claim time**: reject claims with a free-form string `claimed_by` that doesn't parse to the schema fields. Fail fast rather than storing unauditable state.
6. **Code review**: any `claimed_by` field that is a bare string (not a structured object with required fields) is a defect.

## Verification
```sh
# Check for orphaned claims
gad handoffs list --status claimed --projectid <id>
# Any with claim_lease_until in the past = orphans from broken presence tracking

# Verify invariant
gad team list --projectid <id>  # get live_worker count
# claimed_count from handoffs list must be <= live_workers + live_external_agents
```

## Failure modes
- **Free-form string**: `claimed_by: "codex-worker-3"` — unauditable, no lease, no presence check possible.
- **No lease renewal**: worker holds claim for hours, lease expires, sweeper reclaims while worker is still active — double-claim race.
- **Sweeper not running**: orphan backlog grows; invariant breaks silently.
