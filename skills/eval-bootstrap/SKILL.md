---
name: gad:eval-bootstrap
description: Bootstrap an eval agent with full GAD context injected into its prompt. Use instead of gad:eval-run when running implementation evals. Reads AGENTS.md, REQUIREMENTS.xml, CONTEXT.md, and snapshot — then constructs the agent prompt with all context included so the agent starts inside the loop, not outside it.
---

# gad:eval-bootstrap

Constructs and launches an eval agent that starts with full GAD context. The agent doesn't need to "discover" the loop — it's already in it.

## Why this exists

gad-21: Prompting an agent to "use gad snapshot" doesn't work — the agent ignores the CLI and codes directly. This skill injects the context so the agent starts with it.

## When to use

- Running any implementation eval (escape-the-dungeon, portfolio-bare, etc.)
- When you need the eval agent to follow the GAD loop, not just produce code

## Step 1 — Gather context

Read these files and hold their content:

```sh
# 1. The eval template's AGENTS.md (the enforcement doc)
cat evals/<project>/template/AGENTS.md

# 2. Requirements
cat evals/<project>/template/.planning/REQUIREMENTS.xml

# 3. Pre-planning context (if exists)
cat evals/<project>/template/.planning/phases/01-pre-planning/01-CONTEXT.md 2>/dev/null

# 4. Source design docs
ls evals/<project>/source-*

# 5. Current planning state
cat evals/<project>/template/.planning/STATE.xml
cat evals/<project>/template/.planning/ROADMAP.xml
cat evals/<project>/template/.planning/TASK-REGISTRY.xml
```

## Step 2 — Construct the agent prompt

Build the prompt with ALL context inline. The agent should NOT need to read files to understand what it's doing:

```
You are implementing [project name] using the GAD planning loop.

## Your working rules (from AGENTS.md)
[inline the full AGENTS.md content here]

## Requirements
[inline REQUIREMENTS.xml content]

## Pre-planning decisions
[inline CONTEXT.md content]

## Current planning state
[inline STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml]

## Source design docs
[inline or summarize the source docs — if too large, include the first 200 lines
and tell the agent where to read the rest]

## Your task
Implement this project following the loop defined in AGENTS.md.
Start with phase 01 if no phases are planned yet.
Update planning docs PER TASK, not at the end.
Commit after each task with the task id in the message.
```

## Step 3 — Launch the agent

Use the Agent tool with `isolation: "worktree"` so the agent works on an isolated copy:

```
Agent(
  prompt=<constructed prompt>,
  isolation="worktree",
  run_in_background=true
)
```

## Step 4 — After completion

When the agent finishes:

1. Check the worktree for planning doc updates
2. Run `gad eval trace reconstruct --project <name>` to build TRACE.json from git
3. Review: did the agent follow the loop? Check TASK-REGISTRY.xml for per-task updates
4. Score and compare against prior runs

## What this replaces

This replaces the old `gad:eval-run` approach of telling the agent to run CLI commands. The agent no longer needs CLI access — it has all context inline and just needs to update the planning XML files as it works.

## Definition of done

An eval is properly bootstrapped when:
- Agent prompt includes full AGENTS.md, REQUIREMENTS.xml, CONTEXT.md, and STATE
- Agent works in isolated worktree
- Agent updates TASK-REGISTRY.xml per task (verifiable via git log)
- Agent commits with task ids in messages
- TRACE.json can be reconstructed from git history after completion
