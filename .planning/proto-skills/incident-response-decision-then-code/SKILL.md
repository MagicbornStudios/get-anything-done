---
status: proto
workflow: ./workflow.md
description: Incident response with structural patches must log decisions FIRST, then implement, then test, then postmortem
triggers:
  - incident response
  - structural patch
  - root cause identified
  - hotfix
---

# Incident Response Decision-Then-Code

## When to use
Any incident response that results in a structural code patch — not just a typo fix, but a change that embodies a rule or constraint. The decision is the spec; the code is the implementation.

## Why this matters
Today's incident response (GLOBAL-D-330..333) followed the right order: decisions first, then code. But past incidents show the pattern breaking — agents fix the code, then write a post-hoc decision that rationalizes what was done rather than driving it. Commit messages as the sole record are unsearchable by `gad decisions list` and invisible to future agents doing context-oriented queries. The decision record is the durable artifact; the commit is ephemeral metadata.

## Triggers
- "active incident"
- "hotfix with structural change"
- "root cause identified, about to code"
- "incident response"

## Success criteria
- Decision record exists BEFORE any code changes committed
- Error record exists (if implementation mistake involved)
- Commit message references decision ID
- State log has postmortem entry
- Evolution sweep fired in same session

## Anti-patterns
- Committing the fix then writing the decision as retrospective
- Using commit message as the sole record of the rule
- Incident response without an error record (even if root cause was external)
- Fixing without triggering evolution sweep

## See also
- GLOBAL-D-330, GLOBAL-D-331, GLOBAL-D-332, GLOBAL-D-333
- CLAUDE.md workflow-discipline rule 4 (decisions before code for structural work)
- `evolution-loop-discipline` (sister skill)
