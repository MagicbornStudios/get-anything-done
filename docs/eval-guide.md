# GAD Eval Guide

How to set up, run, score, and publish evaluations.

## What's an eval?

An eval is a controlled experiment: give an AI agent a task, measure what it produces. GAD evals are categorized by:

- **Domain**: game, skill, software, business, stories, tooling
- **Mode**: greenfield (from scratch) or brownfield (extend existing code)
- **Workflow**: gad (full framework), bare (no framework), emergent (inherited skills)
- **Tech stack**: optional — phaser, pixijs, threejs, etc.

## Setting up an eval

### 1. Scaffold

```bash
gad eval setup --project my-eval
```

Creates `evals/my-eval/` with template directory and planning files.

### 2. Configure gad.json

Edit `evals/my-eval/gad.json`:

```json
{
  "type": "eval",
  "name": "my-eval",
  "description": "What this eval tests",
  "eval_mode": "greenfield",
  "workflow": "bare",
  "domain": "game",
  "tech_stack": "phaser",
  "build_requirement": "playable HTML game",
  "trace": true,
  "template": "template/"
}
```

**Key fields:**
- `domain`: game | skill | software | business | stories | tooling
- `build_requirement`: What the agent must produce for the eval to be "done"
- `tech_stack`: Optional framework constraint
- `human_estimate_hours`: How long a human developer would take (set by agent in TRACE.json)

### 3. Write requirements

Add `template/.planning/REQUIREMENTS.xml` or `REQUIREMENTS.md` with the task specification.

### 4. Install skills (optional)

```bash
# Install framework skills
gad eval run --project my-eval --install-skills .agents/skills/my-skill

# Inherit skills from a previous run (emergent testing)
gad eval inherit-skills --from other-project/v3 --to my-eval
```

## Running an eval

```bash
# Generate prompt for manual agent run
gad eval run --project my-eval --prompt-only

# Generate prompt + execution payload
gad eval run --project my-eval --execute
```

The prompt goes to your AI agent. The agent builds the project, and when done:

```bash
# Preserve the outputs (MANDATORY)
gad eval preserve my-eval v1 --from <agent-worktree>

# Verify preservation
gad eval verify
```

## Scoring

### Human review

```bash
# Single score
gad eval review my-eval v1 --score 0.7

# Rubric (per-dimension)
gad eval review my-eval v1 --rubric '{"playability": 0.8, "ui_polish": 0.6}'
```

### Automated scoring

```bash
gad eval score --project my-eval
```

### Compare runs

```bash
gad eval scores my-eval        # Compare all runs
gad eval diff v1 v2            # Detailed diff
gad eval report                # Cross-project comparison
```

## Build requirements by domain

| Domain | Build requirement | Display |
|---|---|---|
| game | Playable HTML game | iframe |
| skill | SKILL.md + evals.json (or REQUIREMENTS.xml) | README |
| software | Running web app | iframe |
| business | Running app with mock data | iframe |
| stories | Remotion composition | iframe (player) |
| tooling | Benchmark report | README |

Non-GUI builds display their README. GUI builds embed in iframe.

## Tech stack comparisons

Same requirements, different frameworks:

```bash
gad eval setup --project etd-phaser
gad eval setup --project etd-pixijs
# Set tech_stack in each gad.json
# Run each, compare scores
```

## Eval completion gates

An eval is "done" when:
1. The **build requirement** is produced (game, requirements file, app, etc.)
2. **Human review** is submitted
3. Results are **preserved** (`gad eval preserve`)

Reverse-engineer evals are **gated**: the requirements file isn't validated until a second eval builds from those requirements.

## Publishing to the site

After scoring, rebuild site data:

```bash
cd site && pnpm build
```

Scores appear on the landing page in the Playable Archive and Results sections.
