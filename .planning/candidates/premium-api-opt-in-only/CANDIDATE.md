# Candidate: premium-api-opt-in-only

## Source
Incident response 2026-05-09, GLOBAL-D-332.

## Observation
Kael dual-generate feature shipped default-on and doubled Anthropic spend per chat submit. Health probes were also found to silently fall back to paid endpoints when free endpoints were unavailable. Neither pattern was caught in code review because no rule existed.

## Hypothesis
If features that multiply premium-API calls are gated behind explicit opt-in env flags (default absent = off) and health probes are forbidden from calling paid endpoints, cost multiplier incidents drop to zero.

## Evidence
- GLOBAL-D-332 (decision record)
- `.planning/datasets/ai-spend-ledger/` (spend anomaly detection)
- `apps/desktop/src/components/kael/KaelFocusMode.tsx` (dual-generate removal)
