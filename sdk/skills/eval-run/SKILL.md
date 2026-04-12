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
5. **Runtime attribution** in `TRACE.json.runtime_identity` — which coding agent/runtime actually performed the run

**If any of these are missing, the run is invalid and must be re-executed.**
Verify with `gad eval verify`. The test suite enforces this via `tests/eval-preservation.test.cjs`.

## The Project Layout Contract (mandatory)

Every eval — regardless of framework (GAD, bare, emergent) — MUST place ALL workflow
artifacts under `game/.planning/`:

```
game/
├── .planning/            ← ALL workflow artifacts (WORKFLOW.md, DECISIONS, skills/, etc.)
├── src/                  ← source code only
├── public/               ← assets only
└── package.json, etc.    ← build config only
```

This separates process artifacts from source code so experiments can be compared cleanly.
The format inside `.planning/` is entirely up to the agent — XML, Markdown, whatever —
but workflow files MUST NOT be mixed into source directories or placed at the project root.

`gad eval preserve` detects violations (missing `.planning/`, workflow files outside
`.planning/`) and logs warnings. Record violations in human review notes.

## When to use this skill

- User says "run the eval", "start the eval", "run round N"
- You need to run a specific impl eval project against its requirements
- You need to A/B compare conditions (GAD vs bare vs emergent)

## Procedure

### Step 1 — Generate the bootstrap prompt

```sh
gad eval run --project <project-name> --prompt-only --runtime <claude-code|codex|cursor|...>
```

This creates `evals/<project>/v<N>/PROMPT.md` by inlining:
- The current `template/AGENTS.md`
- The current `template/REQUIREMENTS.xml` (and any versioned variant)
- Source docs from `template/source-*`
- Any planning files in `template/.planning/`
- Any inherited skills in `template/skills/` (for emergent evals)

The generated `v<N>` directory becomes the canonical home for this run's artifacts.
The runtime argument is mandatory for trustworthy telemetry. It stamps `TRACE.json`,
sets the expected hook target, and tells the operator which runtime must have GAD hooks installed.

### Step 2 — Spawn an isolated agent

Use the Agent tool with `isolation: "worktree"` to run the prompt in an isolated git
worktree. The agent should build the project under `game/` in the worktree root.

Pass the prompt file path in the agent's instructions so they can re-read it if needed.
`gad eval run` now attempts to ensure the target runtime install globally before the run starts. You can still verify or repair it manually:

```sh
gad install all --claude --global   # Claude Code
gad install all --codex --global    # Codex
gad install all --cursor --global   # Cursor
```

And ensure the run executes with:

```text
GAD_RUNTIME=<runtime-id>
GAD_LOG_DIR=<eval-run-dir>/.gad-log
GAD_EVAL_TRACE_DIR=<eval-run-dir>
```

New `gad eval run` prompts include both POSIX and PowerShell snippets for this.

### Step 3 — Preserve outputs (MANDATORY)

After the agent completes:

```sh
gad eval preserve <project-name> v<N> --from <worktree-path>
```

This copies:
- `<worktree>/game/src/`, `public/`, `.planning/`, `skills/`, config files → `evals/<project>/v<N>/run/`
- `<worktree>/game/dist/` → `apps/portfolio/public/evals/<project>/v<N>/`
- `<worktree>/.planning/.gad-log/` → `evals/<project>/v<N>/.gad-log/` (if present)
- runtime-attributed eval logs routed via `GAD_LOG_DIR` → `evals/<project>/v<N>/.gad-log/`

**Do this for every run, without exception.** If you skip it, the outputs are lost
when the worktree is cleaned up. The test suite will fail if preservation is missing
for any new run.

### Step 4 — Verify preservation

```sh
gad eval verify
```

Shows a table of all runs and flags any missing artifacts. Every recent run should
show OK. Runtime identity is now part of that contract. Legacy runs may still fail
verification because they predate runtime attribution; treat that as historical debt,
not as a reason to weaken the contract for new runs.

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
