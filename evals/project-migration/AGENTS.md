# Agent guide — project-migration eval

This eval measures how well a project migration from legacy RP planning to GAD preserves planning continuity, skill coverage, and context efficiency.

## How to run

1. Pick a project to migrate (must have legacy rp-* planning or XML-based .planning/)
2. Follow the repeatable pattern checklist in REQUIREMENTS.md
3. After migration, run `gad state --projectid <id>` and `gad phases --projectid <id>`
4. Score each metric in REQUIREMENTS.md
5. Write results to `v<N>/RUN.md` and `v<N>/SCORE.md`

## What to measure

Run these commands before and after migration and record the output:
```sh
gad projects list
gad state --projectid <id> --json
gad phases --projectid <id> --json
gad tasks --projectid <id> --json
```

Note which fields return "—" (gaps) before and after.

## Baseline: repo-planner migration (v1)

See `v1/RUN.md` for the documented repo-planner migration results.
