# Workflow: Phase Task Skill Attribution Discipline

## Inputs
- Task ID being closed
- Skill slug(s) that were applied to complete the task
- Access to `gad tasks stamp`

## Steps
1. Before calling `gad tasks stamp`, identify which skill(s) actually guided the work. If no skill was loaded, use the closest applicable slug (e.g., `gad-do`, `frontend-design`, etc.).
2. Stamp with skill: `gad tasks stamp <task-id> --projectid <id> --status done --agent <name> --runtime <runtime-id> --skill <slug>`.
3. If multiple skills applied, stamp with the primary skill. Secondary skills can be noted in the state log entry.
4. **Audit path**: before closing a phase, run `gad tasks list --projectid <id> --phase <n>` and verify every done task has a non-null skill. Tasks with null skill = attribution gap.
5. Retroactive fix: `gad tasks stamp <id> --skill <slug>` can be run after the fact; do it before moving on, not in a cleanup pass that never happens.

## Verification
```sh
gad tasks list --projectid <id> --phase <n> | grep '"skill": null'
# Must return 0 results for a fully attributed phase
```

## Failure modes
- **Forgot to --skill at stamp time**: run stamp again with `--skill`; stamp is idempotent on non-terminal fields.
- **No applicable skill exists**: that's a signal to register a proto-skill — note it in the evolution backlog.
- **Skipping attribution because the task was "trivial"**: trivial tasks are EXACTLY what the curator uses as positive examples. Skip nothing.
