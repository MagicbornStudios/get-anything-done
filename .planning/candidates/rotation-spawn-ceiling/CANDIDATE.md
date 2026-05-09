# Candidate: rotation-spawn-ceiling

## Source
Incident response 2026-05-09, GLOBAL-D-331.

## Observation
Retry-rotation logic against premium APIs had no spawn ceiling, no per-rotation cooldown check, and no `unclaim_history` recording. A single work-unit triggered unbounded rotations that burned through multiple accounts before the operator detected it.

## Hypothesis
Three guards prevent the failure mode: (1) MAX_INNER_ROTATIONS=3 ceiling enforced before every spawn, (2) cooldown check before EVERY spawn including mid-rotation, (3) every retry written to `unclaim_history` so per-handoff circuit breakers can trip.

## Evidence
- GLOBAL-D-331 (decision record)
- `.planning/team/runtime-cooldown.json` (cooldown state structure)
