---
name: gad:eval-suite
description: Run multiple eval projects in parallel and compare results across all projects
---

# gad:eval-suite

Runs multiple eval projects in parallel using the Agent tool, then reconstructs traces and produces a cross-project comparison report.

## When to use

- After making changes to GAD skills, workflows, or CLI
- When iterating on the framework and need to validate across multiple projects
- Regular eval cadence — run the suite, review, improve, repeat

## Step 1 — Generate bootstrap prompts

```sh
gad eval suite
```

This finds all eval projects with a `template/` directory and generates a PROMPT.md for each. Output goes to a timestamped directory under `evals/.suite-runs/`.

To run specific projects only:
```sh
gad eval suite --projects escape-the-dungeon,portfolio-bare
```

## Step 2 — Launch agents in parallel

For EACH prompt file generated, launch a background agent:

```
Agent(
  prompt=<contents of the PROMPT.md file>,
  isolation="worktree",
  run_in_background=true
)
```

**All agents launch in a single message** — parallel, not sequential.

## Step 3 — Wait for completion

All agents run simultaneously. You're notified as each completes.

## Step 4 — Reconstruct traces

For each completed eval:

```sh
gad eval trace reconstruct --project <name>
```

This parses git history from the eval's worktree to build TRACE.json — no agent cooperation needed (gad-22).

## Step 5 — Cross-project report

```sh
gad eval report
```

Produces a comparison table across all projects:

| Project | Version | Phases | Tasks | Discipline | Planning | Skill Acc | Composite |
|---------|---------|--------|-------|------------|----------|-----------|-----------|

To compare specific projects:
```sh
gad eval report --projects escape-the-dungeon,portfolio-bare
```

## Step 6 — Report findings

For each eval:
- What improved vs last run?
- What regressed?
- What skills were triggered / missing?
- What conventions were generated?

Cross-eval patterns:
- Which skills work across all project types?
- Which need per-project adaptation?
- Where does the loop break consistently?

## Iteration cycle

```
make changes → gad eval suite → launch agents → gad eval report → review → repeat
```

Each iteration should:
1. Fix at least one finding from the prior run
2. Add at least one new eval criterion
3. Tighten at least one skill based on findings

## CLI quick reference

| Command | Purpose |
|---------|---------|
| `gad eval suite` | Generate prompts for all runnable evals |
| `gad eval run --project <name> --prompt-only` | Generate prompt for one eval |
| `gad eval run --project <name>` | Generate prompt + create worktree |
| `gad eval trace reconstruct --project <name>` | Build TRACE.json from git history |
| `gad eval report` | Cross-project comparison table |
| `gad eval scores --project <name>` | Compare runs within one project |
| `gad eval diff v1 v2 --project <name>` | Diff two specific runs |
