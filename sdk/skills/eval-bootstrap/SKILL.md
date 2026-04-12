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
gad eval run --project <name> --prompt-only --runtime <claude-code|codex|cursor|...>

# For all runnable evals:
gad eval suite
```

This reads all template files (AGENTS.md, REQUIREMENTS.xml, DECISIONS.xml, CONVENTIONS.md, ROADMAP.xml, STATE.xml) and constructs a complete prompt with everything inline.
The runtime argument also stamps `TRACE.json.runtime_identity` and tells the operator
which hook install path must be active for the run.

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
Before launch, make sure the target runtime install succeeded and that the run inherits
the eval env from the prompt:

```text
GAD_RUNTIME=<runtime-id>
GAD_LOG_DIR=<eval-run-dir>/.gad-log
GAD_EVAL_TRACE_DIR=<eval-run-dir>
```

## Step 3 — After completion (PRESERVATION IS MANDATORY)

When the agent finishes, **BEFORE the worktree is cleaned up**:

1. **PRESERVE the outputs** — this is not optional:
   ```sh
   gad eval preserve <project-name> v<N> --from <worktree-path>
   ```
   This copies code, planning docs, and build to canonical per-version locations.
   Without this step, the agent's work is lost when the worktree is removed.

2. **Verify preservation worked**:
   ```sh
   gad eval verify <project-name>
   ```
   Should show OK for the new version.

3. **Write or reconstruct TRACE.json**:
   ```sh
   gad eval trace from-log --project <name> --version v<N>
   # or
   gad eval trace reconstruct --project <name> --version v<N>
   ```

4. **Human review**:
   ```sh
   gad eval open <project-name> v<N>
   gad eval review <project-name> v<N> --score <0-1> --notes "..."
   ```

5. **Cross-project report**:
   ```sh
   gad eval report
   ```

## The preservation contract

Every impl eval run MUST preserve: TRACE.json, runtime identity, run/ (code), build (under apps/portfolio/public/evals/), and .gad-log/ (CLI calls). `gad eval verify` now treats missing runtime identity as a preservation failure for new runs. See `gad:eval-run` skill for the full procedure.

## What this replaces

This replaces the old approach of manually reading template files and constructing prompts inline. The `gad eval run --prompt-only` command now automates the prompt construction (agent-agnostic per gad-01).

## Definition of done

An eval is properly bootstrapped when:
- Agent prompt includes full AGENTS.md, REQUIREMENTS.xml, DECISIONS.xml, and STATE
- Agent works in isolated worktree
- Runtime identity and per-run log directory are configured before the agent starts
- Agent updates TASK-REGISTRY.xml per task (verifiable via git log)
- Agent commits with task ids in messages
- TRACE.json can be reconstructed from git history after completion
