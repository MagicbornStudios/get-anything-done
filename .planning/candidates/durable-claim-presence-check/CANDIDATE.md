# Candidate: durable-claim-presence-check

## Source
Incident response 2026-05-09, GLOBAL-D-333.

## Observation
Handoff claim records used free-form `claimed_by` strings with no structured identity, no lease expiry, and no orphan-reclaim sweeper. When agents crashed or were rate-limited, claims persisted indefinitely. The invariant `claimed_count <= live_workers` broke without any automated detection.

## Hypothesis
Structured claim records with durable identity fields and `claim_lease_until`, paired with an orphan-reclaim sweeper, enforce the invariant continuously without operator intervention.

## Evidence
- GLOBAL-D-333 (decision record)
- `.planning/team/runtime-cooldown.json` (live worker state)
