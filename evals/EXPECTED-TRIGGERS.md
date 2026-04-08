# Expected Skill Triggers for Implementation Evals

This defines which GAD skills SHOULD fire during an implementation eval and when. Used to populate `skill_accuracy.expected_triggers` in TRACE.json.

## Standard implementation eval triggers (v3)

Only actual `/gad:*` skill invocations count. Methodology behaviors (decision capture,
phase completion, task lifecycle) are measured by other dimensions — not skill_accuracy.

| Skill | When | Required? | Verifiable artifact |
|-------|------|-----------|-------------------|
| `/gad:plan-phase` | Before execution | Yes | ROADMAP.xml has phases with goals |
| `/gad:execute-phase` | Per phase | Yes | TASK-REGISTRY.xml has tasks marked done |
| `/gad:task-checkpoint` | Between tasks | Yes | Commits exist per task (task-id in message) |
| `/gad:auto-conventions` | After first code phase | Yes (greenfield) | CONVENTIONS.md exists in .planning/ |
| `/gad:verify-phase` | After each phase | Recommended | Build/typecheck passes, VERIFICATION.md |
| `/gad:check-todos` | Session start | Recommended | Agent checked for open tasks before starting |

## Expected triggers JSON (for TRACE.json)

```json
{
  "expected_triggers": [
    { "skill": "/gad:plan-phase", "when": "before first implementation task", "triggered": false },
    { "skill": "/gad:execute-phase", "when": "per phase implementation", "triggered": false },
    { "skill": "/gad:task-checkpoint", "when": "between tasks", "triggered": false },
    { "skill": "/gad:auto-conventions", "when": "after first code phase (greenfield)", "triggered": false },
    { "skill": "/gad:verify-phase", "when": "after phase completion", "triggered": false },
    { "skill": "/gad:check-todos", "when": "session start", "triggered": false }
  ]
}
```

## How trace reconstruct checks this

`gad eval trace reconstruct` infers trigger compliance from artifacts:
- `/gad:plan-phase` → ROADMAP.xml has phases with goals (not empty)
- `/gad:execute-phase` → TASK-REGISTRY.xml has tasks marked done
- `/gad:task-checkpoint` → commits exist per task (git log has task-id commits)
- `/gad:auto-conventions` → CONVENTIONS.md exists in .planning/
- `/gad:verify-phase` → build/typecheck passes, VERIFICATION.md exists
- `/gad:check-todos` → gad snapshot or gad tasks was called at session start (from logs)

## Scoring

```
skill_accuracy = skills_triggered / skills_expected
```

A skill is "triggered" if its verifiable artifact exists, not if the agent claims it ran.

## Note on skill_accuracy as a dimension (v3)

After cleanup, skill_accuracy is 100% (6/6) across all implementation evals. This means
the dimension currently has zero discriminating power — it doesn't separate good runs from
bad runs.

To make this dimension useful again, consider:
1. Adding quality scoring per invocation (not just triggered/not)
2. Testing with more skills (currently only 6 of 22)
3. Testing failure conditions where skills should fire but don't

Until then, skill_accuracy's 0.176 weight in auto_composite is essentially a constant.

## Skills NOT tested by any eval

These 16 skills have never appeared in expected_triggers:

- `gad:add-todo` — needs scenario where ideas emerge mid-session
- `gad:debug` — needs A/B comparison with error injection
- `gad:eval-bootstrap` — self-referential (tested by running evals)
- `gad:eval-report` — self-referential (tested by running reports)
- `gad:eval-run` — self-referential (tested by running evals)
- `gad:eval-suite` — self-referential (tested by running suites)
- `gad:manuscript` — needs creative writing eval
- `gad:map-codebase` — needs brownfield codebase analysis eval
- `gad:milestone` — needs project lifecycle eval
- `gad:new-project` — needs project bootstrap eval
- `gad:reverse-engineer` — tested via human review of reimplementation
- `gad:session` — needs context persistence eval
- `gad:snapshot-optimize` — needs large-project token optimization eval
- `gad:write-feature-doc` — needs documentation quality eval
- `gad:write-intent` — needs project intent capture eval
- `gad:write-tech-doc` — needs documentation quality eval
