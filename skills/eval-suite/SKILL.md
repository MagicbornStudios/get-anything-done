---
name: gad:eval-suite
description: Run multiple eval projects in parallel. Use when iterating on GAD — run portfolio-bare + escape-the-dungeon + any other evals simultaneously, then compare results across all projects.
---

# gad:eval-suite

Runs multiple eval projects in parallel using the Agent tool, then reconstructs traces and produces a comparison report.

## When to use

- After making changes to GAD skills, workflows, or CLI
- When iterating on the framework and need to validate across multiple projects
- Regular eval cadence — run the suite, review, improve, repeat

## Step 1 — List eval projects to run

```sh
gad eval list
```

Pick which projects to include in this run. Default: all projects with a `template/` directory.

## Step 2 — Launch agents in parallel

For EACH eval project, launch a background agent using the eval-bootstrap skill approach:

1. Read the project's `template/AGENTS.md`
2. Read `REQUIREMENTS.md` or `template/.planning/REQUIREMENTS.xml`
3. Read any CONTEXT.md from prior discussion
4. Construct the bootstrap prompt (inline all context)
5. Launch via Agent tool with `isolation: "worktree"` and `run_in_background: true`

**All agents launch in a single message** — parallel, not sequential.

## Step 3 — Wait for completion

All agents run simultaneously. You're notified as each completes.

## Step 4 — Reconstruct traces

For each completed eval:

```sh
gad eval trace reconstruct --project <name>
```

## Step 5 — Compare results

Build a comparison table:

| Project | Phases | Tasks | Task-ID Commits | State Updates | Decisions | Conventions | Discipline | Composite |
|---------|--------|-------|-----------------|---------------|-----------|-------------|------------|-----------|
| portfolio-bare | X | Y | Z | ... | ... | ... | ... | ... |
| escape-the-dungeon | X | Y | Z | ... | ... | ... | ... | ... |
| reader-workspace | X | Y | Z | ... | ... | ... | ... | ... |

## Step 6 — Report findings

For each eval:
- What improved vs last run?
- What regressed?
- What skills were triggered / missing?
- What conventions were generated?

Cross-eval:
- Which skills work across all project types?
- Which need per-project adaptation?
- Where does the loop break consistently?

## Iteration cycle

```
make changes → run suite → review findings → make more changes → run suite
```

Each iteration should:
1. Fix at least one finding from the prior run
2. Add at least one new eval project OR new eval criterion
3. Tighten at least one skill based on findings
