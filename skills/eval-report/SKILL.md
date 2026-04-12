---
name: gad:eval-report
description: Generate comparison reports across eval runs, within a single project or across all projects
---

# gad:eval-report

Reads TRACE.json files and produces comparison reports — within a project (across versions) or across all projects (cross-eval).

## When to use

- After one or more eval runs have completed
- After running `gad eval suite` and reconstructing traces
- When iterating on skills and need to see the impact
- User asks about eval results or progress

## Step 1 — Reconstruct traces (if needed)

For each eval that ran in a worktree agent:

```sh
gad eval trace reconstruct --project <name>
```

This parses git history to build TRACE.json — no agent cooperation needed (gad-22).

## Step 2 — Choose the right report

### Cross-project comparison (the big picture)

```sh
gad eval report
```

Shows a table across ALL projects with the latest trace for each:

| Project | Version | Phases | Tasks | Discipline | Planning | Skill Acc | Composite |

### Within-project comparison (version-over-version)

```sh
gad eval scores --project <name>
```

Shows how scores evolved across runs of one project.

### Two-version diff

```sh
gad eval diff v1 v2 --project <name>
```

Detailed diff between two specific runs.

## Step 3 — Interpret findings

### Per-task discipline score

Measures whether the agent committed with task IDs. Low discipline (< 0.5) means the agent is batching work instead of following the atomic commit loop. Fix: tighten AGENTS.md in the eval template, add checkpoint enforcement.

### Planning quality score

Measures task completion rate and state freshness. Low planning quality means the agent planned tasks but didn't complete them, or STATE.xml drifted. Fix: verify that ROADMAP.xml phases are right-sized.

### Skill accuracy

Measures whether the right skills were triggered at the right time. Missing triggers mean the agent bypassed the methodology. Fix: make skill triggers more obvious in AGENTS.md, or add checkpoint gates.

### Composite score

Weighted combination: skill_accuracy (0.25) + planning_quality (0.30) + time_efficiency (0.20) + per_task_discipline (0.25).

## Step 4 — Write findings

After reviewing, update the eval-suite skill or create a decision:

- If a pattern appears across ALL evals: it's a framework issue → update a skill
- If a pattern appears in only one eval: it's a project-specific issue → update that eval's AGENTS.md
- If a score regressed: find what changed and revert or fix

## CLI quick reference

| Command | Purpose |
|---------|---------|
| `gad eval report` | Cross-project comparison table |
| `gad eval scores --project <name>` | Version-over-version for one project |
| `gad eval diff v1 v2 --project <name>` | Detailed two-version diff |
| `gad eval trace reconstruct --project <name>` | Build TRACE.json from git history |
| `gad eval trace report --project <name>` | Aggregate trace stats for one project |
