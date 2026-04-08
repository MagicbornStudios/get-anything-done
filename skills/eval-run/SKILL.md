---
name: gad:eval-run
description: Run a GAD evaluation with full preservation of code, builds, and planning docs
---

# gad:eval-run

A GAD eval is a controlled experiment. Every run MUST preserve its outputs so that
experiments are reproducible and comparable. This skill describes the full procedure.

## The Preservation Contract (mandatory)

Every eval run on an implementation project MUST end with these artifacts preserved:

1. **TRACE.json** at `evals/<project>/v<N>/TRACE.json` — measurement results
2. **Code + planning docs** at `evals/<project>/v<N>/run/` — what the agent built
3. **Build output** at `apps/portfolio/public/evals/<project>/v<N>/` — playable demo
4. **CLI logs** at `evals/<project>/v<N>/.gad-log/` — what commands the agent ran

**If any of these are missing, the run is invalid and must be re-executed.**
Verify with `gad eval verify`. The test suite enforces this via `tests/eval-preservation.test.cjs`.

## When to use this skill

- User says "run the eval", "start the eval", "run round N"
- You need to run a specific impl eval project against its requirements
- You need to A/B compare conditions (GAD vs bare vs emergent)

## Procedure

### Step 1 — Generate the bootstrap prompt

```sh
gad eval run --project <project-name> --prompt-only
```

This creates `evals/<project>/v<N>/PROMPT.md` by inlining:
- The current `template/AGENTS.md`
- The current `template/REQUIREMENTS.xml` (and any versioned variant)
- Source docs from `template/source-*`
- Any planning files in `template/.planning/`
- Any inherited skills in `template/skills/` (for emergent evals)

The generated `v<N>` directory becomes the canonical home for this run's artifacts.

### Step 2 — Spawn an isolated agent

Use the Agent tool with `isolation: "worktree"` to run the prompt in an isolated git
worktree. The agent should build the project under `game/` in the worktree root.

Pass the prompt file path in the agent's instructions so they can re-read it if needed.

### Step 3 — Preserve outputs (MANDATORY)

After the agent completes:

```sh
gad eval preserve <project-name> v<N> --from <worktree-path>
```

This copies:
- `<worktree>/game/src/`, `public/`, `.planning/`, `skills/`, config files → `evals/<project>/v<N>/run/`
- `<worktree>/game/dist/` → `apps/portfolio/public/evals/<project>/v<N>/`
- `<worktree>/.planning/.gad-log/` → `evals/<project>/v<N>/.gad-log/` (if present)

**Do this for every run, without exception.** If you skip it, the outputs are lost
when the worktree is cleaned up. The test suite will fail if preservation is missing
for any new run.

### Step 4 — Verify preservation

```sh
gad eval verify
```

Shows a table of all runs and flags any missing artifacts. Every recent run should
show OK. Legacy runs (before the preservation contract) are exempt.

### Step 5 — Write or reconstruct TRACE.json

If you have CLI logs:
```sh
gad eval trace from-log --project <project-name> --version v<N>
```

Or reconstruct from git history:
```sh
gad eval trace reconstruct --project <project-name> --version v<N>
```

Or write TRACE.json manually with the measured dimensions (see DEFINITIONS.md).

### Step 6 — Human review

Open the build:
```sh
gad eval open <project-name> v<N>
```

Score it 0.0-1.0 and record:
```sh
gad eval review <project-name> v<N> --score 0.65 --notes "notes here"
```

The composite is automatically recomputed with caps (<0.20 → 0.40, <0.10 → 0.25).

### Step 7 — Check the report

```sh
gad eval report
```

Shows cross-project comparison with human review scores and composite rankings.

## A/B experiments

When running an A/B comparison (e.g., GAD vs bare vs emergent):

1. Generate prompts for all conditions with the SAME base requirements version
2. Launch all agents in parallel (each gets its own worktree)
3. Preserve each run immediately on completion
4. Score all conditions with the same human reviewer and rubric
5. Document findings in `evals/FINDINGS-<date>-<label>.md`
6. Reference the requirements version used in the findings doc

## What gets tested by the preservation test suite

`tests/eval-preservation.test.cjs` enforces:

1. `gad eval preserve` actually copies files correctly
2. Every impl eval run at or after the contract cutoff has `TRACE.json`
3. Every impl eval run at or after the cutoff has `run/` with code
4. Every impl eval run at or after the cutoff has a preserved build

If you add a new impl eval project, update `IMPL_EVAL_PROJECTS` and
`PRESERVATION_CONTRACT_CUTOFF` in the test file.

## Common failure modes

- **Agent forgets to copy build** — `gad eval preserve` handles this for you, don't rely on the agent
- **Worktree cleaned up before preserve** — preserve BEFORE the worktree is removed
- **TRACE.json missing** — write it manually or via `gad eval review` which updates the composite
- **Build renders blank** — still preserve it, but score human_review = 0.0 (caps will apply)
