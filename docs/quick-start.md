# GAD Quick Start

Get from zero to running your first eval in 5 minutes.

## 1. Install a coding agent

Pick one:

```bash
# Claude Code (recommended)
npm install -g @anthropic-ai/claude-code

# OpenAI Codex CLI
npm install -g @openai/codex
```

## 2. Install GAD

```bash
npx get-anything-done@latest
```

This installs the GAD CLI, skills, and hooks into your agent runtime.

## 3. Start a new project

```bash
# Interactive setup — answers questions about what you're building
/gad:new-project

# Or skip the questions and jump straight to planning
gad snapshot --projectid <your-project>
```

## 4. Plan and execute

```bash
/gad:plan-phase 1    # Create a detailed plan
/gad:execute-phase 1 # Execute it with commit tracking
```

## 5. Run an eval

```bash
# List available eval projects
gad eval list

# Scaffold a new eval
gad eval setup --project my-eval

# Generate bootstrap prompt
gad eval run --project my-eval --prompt-only

# Install skills into the eval
gad eval run --project my-eval --install-skills .agents/skills/my-skill

# After the agent completes, preserve the run
gad eval preserve my-eval v1 --from <worktree-path>

# Submit human review
gad eval review my-eval v1 --score 0.7
```

## 6. Check your work

```bash
gad snapshot --projectid <id>  # Full context
gad rounds                     # Experiment history
gad eval report                # Cross-project comparison
```

## Project structure

```
.planning/
├── STATE.xml           # Current state + next action
├── TASK-REGISTRY.xml   # All tasks with status
├── DECISIONS.xml       # Architectural decisions
├── ROADMAP.xml         # Phase breakdown
└── .gad-log/           # Trace data for self-eval
```

## Key concepts

- **Skills**: Methodology documents that agents follow (`.agents/skills/`)
- **Evals**: Controlled experiments measuring agent performance (`evals/`)
- **Domains**: game, skill, software, business, stories, tooling
- **The loop**: snapshot → work → update docs → commit

## CLI reference

```bash
gad --help              # All commands
gad eval --help         # Eval framework
gad data list           # Browse data collections
gad rounds              # Experiment rounds
/gad:help               # Full command reference
```
