---
status: proto
workflow: ./workflow.md
description: Fire gad evolution evolve at every milestone close and incident response to convert lessons into proto-skills
triggers:
  - milestone close
  - incident response complete
  - decisions added without corresponding proto-skills
  - evolution sweep overdue
---

# Evolution Loop Discipline

## When to use
At the end of every milestone and after every incident-response session. This is a standing trigger, not an optional improvement step.

## Why this matters
Incidents and lessons are systematically recorded as decisions and ERRORS-AND-ATTEMPTS entries. But without a sweep that converts those records into proto-skills, the knowledge stays locked in planning XML — agents in future sessions don't benefit from it. The pattern across many phases: decisions accumulate, errors accumulate, the skill library stays flat. The evolution loop closes that gap.

## Triggers
- "milestone closed"
- "incident response decisions logged"
- "evolution sweep overdue"
- "lessons not surfaced as skills"
- "decisions without proto-skills"

## Success criteria
- `gad evolution evolve` run within the same session as milestone close or incident close
- All high-confidence candidates have status `pending_review` (drafted), not `identified` (undrafted)
- State log entry records the sweep and count

## Anti-patterns
- Logging decisions and errors without triggering evolution sweep
- Deferring proto-skill drafting to "next session" (context loss = permanent loss)
- Running `gad evolution evolve` but treating all candidates as low-confidence to avoid drafting
- Skipping the sweep on "small" milestones — high-value lessons come from small targeted work

## See also
- `gad-191` (operator review required before promotion)
- `create-proto-skill` skill (checkpoint protocol)
- `.planning/.evolution-scan.json`
- `memory/feedback_evolution_review_instructions.md`
