# Eval: reverse-engineer-eval v1


**Mode:** greenfield | **Workflow:** gad



You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Reverse-Engineer Eval

## Phase 1: Produce Requirements

You are evaluating the `gad:reverse-engineer` skill. Your task is to analyze the target codebase and produce a complete REQUIREMENTS.xml that captures what was built.

### Target
See the `target/` directory for the source codebase to reverse-engineer.

### Tools available
- `gad:reverse-engineer` skill
- `gad:map-codebase` skill (for structural understanding)
- If the target has GAD planning docs (.planning/), consume them as additional signal

### Output
Write all artifacts to `game/.planning/`:
- `REQUIREMENTS.xml` — structured requirements with testable success criteria
- `DECISIONS.xml` — architectural decisions inferred from code patterns
- `CONVENTIONS.md` — coding conventions observed
- `ROADMAP.xml` — suggested phase breakdown for reimplementation
- `CONTEXT.md` — key context about the project

### Rules
- Capture WHAT was built, not HOW (clean-room)
- Requirements must be testable — each should have success criteria
- Don't copy source code into requirements
- Note integration points that should use mock data for self-contained builds

## Phase 2: Build from Requirements

A SEPARATE agent (no access to original source) receives only the REQUIREMENTS.xml from Phase 1 and builds the project from scratch.

### Rules for build agent
- Build ONLY from the requirements file
- No access to original source code
- If the project has a GUI, it must be viewable in-browser (iframe-embeddable)
- If non-GUI, produce a comprehensive README
- Use mock data for external integrations
- All source in `src/`, assets in `public/`

## Scoring
The eval is scored by comparing the Phase 2 build against the original target.
See gad.json for the rubric dimensions and weights.


## Installed Skills

- `skills/reverse-engineer/SKILL.md`



## Instructions


1. Copy the .planning/ directory from the template into your working directory

2. Implement the project following the ROADMAP.xml phases

3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID — one commit per task, not per phase

4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture

4b. Capture decisions AS YOU MAKE THEM — if you chose between alternatives (library, pattern, data model), write a <decision> to DECISIONS.xml before committing that task. Aim for 1-2 per phase minimum.

5. After EACH phase completes: write/append to .planning/VERIFICATION.md (build result, task count, state check), commit with "verify: phase X verified"

6. When complete: all phases done, build passes, planning docs current

7. FINAL STEP: produce a production build (dist/ directory) and commit it. The build artifact is showcased on the docs site. No dist = eval incomplete.


## Logging


Set GAD_LOG_DIR to your eval run directory before running gad commands.

All gad CLI calls and tool uses will be logged to JSONL files for eval tracing.

```sh
export GAD_LOG_DIR=<eval-run-dir>/.gad-log
```