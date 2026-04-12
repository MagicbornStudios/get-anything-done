# GAD Eval Guide

How to set up, run, preserve, and compare evaluations.

## What an eval is

An eval is a controlled implementation run with preserved artifacts and scoring data. GAD evals
track:

- domain: game, skill, software, business, stories, tooling
- mode: greenfield or brownfield
- workflow: gad, bare, emergent, or another defined condition
- optional tech stack

## Setup

### 1. Scaffold the eval

```bash
gad eval setup --project my-eval
```

### 2. Configure `gad.json`

Edit `evals/my-eval/gad.json` with the eval metadata, workflow, domain, and build requirement.

### 3. Write the requirements

Place the task specification in the template planning files, usually under:

```text
evals/my-eval/template/.planning/
```

### 4. Install skills if needed

Skills and the GAD executable are different install paths.

```bash
# Install GAD skills from GitHub
npx skills add https://github.com/MagicbornStudios/get-anything-done

# Install a local skill into the eval template
gad eval run --project my-eval --install-skills skills/my-skill

# Inherit skills from another run
gad eval inherit-skills --from other-project/v3 --to my-eval
```

## Run flow

Generate the bootstrap prompt and declare the runtime doing the work:

```bash
gad eval run --project my-eval --prompt-only --runtime codex
```

Or create the executable payload/worktree flow:

```bash
gad eval run --project my-eval --execute --runtime codex
```

`gad eval run` now attempts to ensure the selected runtime is installed globally before the run starts. If you want to verify or repair it manually:

```bash
gad install all --codex --global
# or:
gad install all --claude --global
```

The generated prompt now includes the required per-run env:

```text
GAD_RUNTIME=<runtime-id>
GAD_LOG_DIR=<eval-run-dir>/.gad-log
GAD_EVAL_TRACE_DIR=<eval-run-dir>
```

The coding agent performs the work in the eval worktree. When it stops:

```bash
gad eval preserve my-eval v1 --from <agent-worktree>
gad eval verify
```

## What gets preserved

Each completed run should be preserved once, immediately after the agent stops.

Canonical preserved data:

- `evals/<project>/<version>/TRACE.json`
- `evals/<project>/<version>/run/`
- `evals/<project>/<version>/.gad-log/` when raw logs exist
- `TRACE.json.runtime_identity` for the actual runtime that performed the run
- preserved build output for GUI/app evals

The normal cadence is one preserve step per completed run, not every commit.
`gad eval verify` now treats missing runtime identity as a preservation failure for new runs.

## Review and scoring

Human review:

```bash
gad eval review my-eval v1 --score 0.7
gad eval review my-eval v1 --rubric '{"playability": 0.8, "ui_polish": 0.6}'
```

Automated comparison:

```bash
gad eval score --project my-eval
gad eval scores my-eval
gad eval diff v1 v2
gad eval report
```

## Completion gates

An eval is done when:

1. the build requirement exists
2. the run is preserved
3. human review is submitted

## Site publishing

Site publishing is optional. External users can use the eval system entirely from the CLI and
the preserved artifacts.

If you do want the Magicborn site updated, rebuild after scoring:

```bash
cd site && pnpm build
```
