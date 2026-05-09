# Workflow: Rotation Spawn Ceiling

## Inputs
- Retry/rotation logic implementation (or code under review)
- Access to runtime cooldown state: `.planning/team/runtime-cooldown.json`
- Handoff record with `unclaim_history` field

## Steps
1. **Set the ceiling constant** at the top of your rotation logic: `MAX_INNER_ROTATIONS = 3` (per work-unit, not per session).
2. **Before every spawn** (including rotation attempt N>1): read `.planning/team/runtime-cooldown.json`. If target runtime cooldown > 1 hour OR all accounts parked, do NOT spawn — fail the work-unit and unclaim.
3. **Record every retry** in `unclaim_history` on the handoff record: `{ attempt: N, runtime: <id>, reason: "rate_limit|parked|error", ts: <iso> }`. This enables per-handoff filters to detect runaway rotation.
4. **Check ceiling before spawning**: if `unclaim_history.length >= MAX_INNER_ROTATIONS`, stop rotating and escalate (surface to operator or mark handoff as blocked).
5. After ceiling trip: log to ERRORS-AND-ATTEMPTS.xml with the rotation chain as context.

## Verification
```sh
# After a rotation incident, check the handoff unclaim_history
gad handoffs show <id> --projectid <id>
# unclaim_history must have entries for each retry attempt
# No handoff should have unclaim_history.length > MAX_INNER_ROTATIONS
```

## Failure modes
- **No ceiling set**: rotation runs unbounded, burns through all accounts on a single junk handoff.
- **Cooldown check skipped on rotation 2+**: first spawn checks, rotation spawns don't — parked accounts get hit repeatedly.
- **unclaim_history not written**: per-handoff filters can't detect runaway; audit trail missing; operator can't diagnose.
