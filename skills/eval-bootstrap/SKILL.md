---
name: gad:eval-bootstrap
description: Bootstrap an eval agent with full GAD context injected into its prompt. Use instead of gad:eval-run when running implementation evals. Generates the bootstrap prompt via `gad eval run --prompt-only` or reads a suite-generated PROMPT.md, then launches an agent with worktree isolation.
---

# gad:eval-bootstrap

Constructs and launches an eval agent that starts with full GAD context. The agent doesn't need to "discover" the loop — it's already in it.

## Why this exists

gad-21: Prompting an agent to "use gad snapshot" doesn't work — the agent ignores the CLI and codes directly. This skill injects the context so the agent starts with it.

## When to use

- Running any implementation eval (escape-the-dungeon, portfolio-bare, reader-workspace)
- When you need the eval agent to follow the GAD loop, not just produce code

## Step 1 — Generate the bootstrap prompt

```sh
# For a single project:
gad eval run --project <name> --prompt-only

# For all runnable evals:
gad eval suite
```

This reads all template files (AGENTS.md, REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml, STATE.xml) and constructs a complete prompt with everything inline.

The prompt is written to:
- Single: `evals/<project>/v<N>/PROMPT.md`
- Suite: `evals/.suite-runs/<timestamp>/<project>-v<N>.md`

## Step 2 — Launch the agent

Read the generated PROMPT.md and launch via Agent tool:

```
Agent(
  prompt=<contents of PROMPT.md>,
  isolation="worktree",
  run_in_background=true
)
```

For suite runs, launch ALL agents in a single message (parallel, not sequential).

## Step 3 — After completion

When the agent finishes:

1. Check the worktree for planning doc updates and implementation code
2. Run `gad eval trace reconstruct --project <name>` to build TRACE.json from git
3. Run `gad eval score --project <name>` to produce SCORE.md
4. Run `gad eval report` for cross-project comparison

## What this replaces

This replaces the old approach of manually reading template files and constructing prompts inline. The `gad eval run --prompt-only` command now automates the prompt construction (agent-agnostic per gad-01).

## Definition of done

An eval is properly bootstrapped when:
- Agent prompt includes full AGENTS.md, REQUIREMENTS.xml, DECISIONS.xml, and STATE
- Agent works in isolated worktree
- Agent updates TASK-REGISTRY.xml per task (verifiable via git log)
- Agent commits with task ids in messages
- TRACE.json can be reconstructed from git history after completion
