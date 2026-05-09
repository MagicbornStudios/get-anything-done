# Candidate: worker-side-complete-handoff

## Source
Incident response 2026-05-09, GLOBAL-D-330.

## Observation
66 of 264 closed handoffs had `completed_at: null`. Root cause: worker loops were including the handoff ID in child runtime prompts and expecting the child to call `gad handoffs complete`. Codex runs in a sandbox that blocks outbound network/API calls, so the completion call was silently dropped.

## Hypothesis
If workers own the `completeHandoff` call unconditionally — never delegating to child — orphaned completions drop to zero.

## Evidence
- GLOBAL-D-330 (decision record)
- Handoff audit: `gad handoffs list --status claimed` showing null completed_at at scale
