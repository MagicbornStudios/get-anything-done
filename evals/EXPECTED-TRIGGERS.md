# Expected Skill Triggers for Implementation Evals

This defines which GAD skills SHOULD fire during an implementation eval and when. Used to populate `skill_accuracy.expected_triggers` in TRACE.json.

## Standard implementation eval triggers

Every implementation eval should trigger these skills in this order:

| Skill | When | Required? |
|-------|------|-----------|
| `/gad:discuss-phase` | Before planning — gather requirements, clarify decisions | Yes (if pre-planning not done) |
| `/gad:plan-phase` | Before execution — create ROADMAP.xml phases and TASK-REGISTRY.xml tasks | Yes |
| `/gad:execute-phase` | Per phase — implement tasks following the loop | Yes |
| `/gad:task-checkpoint` | Between tasks — verify planning doc updates | Yes |
| `/gad:auto-conventions` | After first implementation phase — generate CONVENTIONS.md | Yes (greenfield only) |
| `/gad:verify-work` | After each phase — check definition of done | Recommended |

## Expected triggers JSON (for TRACE.json)

```json
{
  "expected_triggers": [
    { "skill": "/gad:plan-phase", "when": "before first implementation task", "triggered": false },
    { "skill": "/gad:execute-phase", "when": "per phase implementation", "triggered": false },
    { "skill": "/gad:task-checkpoint", "when": "between tasks", "triggered": false },
    { "skill": "/gad:auto-conventions", "when": "after first code phase (greenfield)", "triggered": false },
    { "skill": "/gad:verify-work", "when": "after phase completion", "triggered": false }
  ]
}
```

## How trace reconstruct checks this

`gad eval trace reconstruct` can infer trigger compliance:
- `/gad:plan-phase` triggered → ROADMAP.xml has phases with goals (not empty)
- `/gad:execute-phase` triggered → TASK-REGISTRY.xml has tasks marked done
- `/gad:task-checkpoint` triggered → commits exist per task (git log has task-id commits)
- `/gad:auto-conventions` triggered → CONVENTIONS.md exists in .planning/
- `/gad:verify-work` triggered → build/typecheck passes

## Scoring

```
skill_accuracy = skills_actually_triggered / skills_expected
```

A skill is "triggered" if its verifiable artifact exists, not if the agent claims it ran the skill.
