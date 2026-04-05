---
name: gad:eval-report
description: Generate a comparison report across portfolio-bare eval runs. Shows fresh-context vs loaded-context performance, task alignment trends, and which planning decisions diverge between context modes. Use after multiple eval runs have been completed. Triggers on: user says "show eval results", "compare runs", "how did the fresh run do", or "eval report".
---

# gad:eval-report

Reads all TRACE.json files for a project and produces a comparison across context modes.

## When to use this skill

- Multiple eval runs have been completed (at least one fresh, one loaded)
- User wants to see how context mode affected planning outcomes
- User wants to understand which parts of the planning are robust vs context-dependent

## Step 1 — Check available runs

```sh
gad eval runs --project portfolio-bare
```

Look at the `ctx` column. You want at least one `fresh` and one `loaded` run before the comparison is meaningful.

## Step 2 — Generate the trace report

```sh
gad eval trace report --project portfolio-bare
```

This shows:
- Per-run: tasks completed, context mode, score
- Cross-run: which tasks appear in all runs vs only some
- Fresh vs loaded delta: did loaded context produce better task alignment or state hygiene?

## Step 3 — Interpret the report

### If loaded runs score higher than fresh runs

Context is providing real signal. The planning docs (ROADMAP.xml, TASK-REGISTRY.xml, DECISIONS.xml) that an agent reads before starting are genuinely helping it make better choices. This validates the cli-efficiency eval's information_loss = 0 claim.

### If fresh runs score equally or higher

Either:
- The requirements are clear enough that context adds nothing (fine — good requirements)
- The loaded-context agent is being distracted by prior state (a smell — planning docs may be noisy)
- Not enough runs yet to see the difference (run more)

### If a specific task only appears in loaded runs

That task was only identified when the agent had context. Fresh agents either skipped it or called it something else. This is the most actionable finding — it surfaces tasks that are easy to miss without context.

### If a specific task appears in all runs regardless of context

That task is requirements-derivable. It will be planned correctly even without prior context. These are your most robust tasks.

## Step 4 — Write a summary

After reading the report, write a brief EVAL-SUMMARY.md in the eval version directory:

```md
# Eval Summary — portfolio-bare vN

**Runs:** N total (X fresh, Y loaded)
**Context delta:** loaded score − fresh score = Z

## Most robust tasks (appear in all runs)
- ...

## Context-dependent tasks (loaded only)
- ...

## Action items
- ...
```

This summary is the human-readable output of the eval. The TRACE.json is the machine-readable version.
