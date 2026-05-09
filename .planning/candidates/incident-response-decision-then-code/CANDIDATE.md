# Candidate: incident-response-decision-then-code

## Source
Today's incident pattern (GLOBAL-D-330..333) + workflow audit findings 2026-05-08.

## Observation
Agents under incident pressure default to fixing code first and writing decisions after, turning decisions into post-hoc rationalizations. Commit messages are used as the "record" but aren't queryable by planning tools. Future agents can't reconstruct intent from commits alone.

## Hypothesis
If the decision is logged before any code change during incident response, the rule is the spec and the code implements it — keeping intent and implementation aligned and queryable.

## Evidence
- GLOBAL-D-330..333 (correct order exemplar from today)
- `reports/research/workflow_audit.md` (audit findings 2026-05-08)
- CLAUDE.md workflow-discipline rule 4
