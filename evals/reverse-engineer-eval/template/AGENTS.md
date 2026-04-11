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
