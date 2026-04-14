# Eval: escape-the-dungeon-bare v2


You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Agent guide — Escape the Dungeon (bare eval)

You are building a roguelike dungeon crawler game. Your job is to implement the full game
described in `REQUIREMENTS.xml` and deliver a working production build.

## Before you start coding

1. **Read `REQUIREMENTS.xml`** — this is what you're building. Read it carefully.
2. **Read the source docs** — `source-GAMEPLAY-DESIGN.xml` and `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` contain the full game design.
3. **Research the Ralph Wiggum loop** — search the web for "Ralph Wiggum loop AI agents" and "plan-do-check-act coding agents". This is a framework for how AI agents can organize their work. Study what people have built and how they track progress.
4. **Create your own workflow** — based on what you learn, create a system to track your work. You decide the format. Some things to consider:
   - How will you track what's done vs what's left?
   - How will you break the game into manageable pieces?
   - How will you remember architectural decisions you make?
   - How will you verify each piece works before moving on?

Write your workflow system down in a file so you can reference it throughout the build.

## During implementation

- **Use your workflow.** Follow whatever system you created. Update it as you go.
- **When you hit a wall** — if you encounter a problem type you've seen before (e.g. "every time I add a new game system, I need to do X, Y, Z"), write down a reusable pattern or checklist for it. Think of these as "skills" — documented approaches you can reuse.
- **Iterate on your process.** If your tracking system isn't working well, change it. If you find you need a new artifact type, create one. The workflow should evolve with the project.
- **Commit regularly.** Each commit should represent a meaningful unit of work.

## What you are NOT given

- No planning framework or CLI tools
- No pre-built task tracking system
- No predefined workflow or loop
- No skills library

You are responsible for creating whatever organizational structure you need.

## Build and verify

```sh
cd game/
npm install
npm run dev        # dev server
npx tsc --noEmit   # type check
npm run build      # production build
```

## Final deliverable (MANDATORY)

Your LAST step must produce a working production build:

1. Run `npm run build` in `game/` — it must succeed with zero errors
2. The `game/dist/` directory must contain a playable `index.html` + assets
3. Verify the build works: the index.html should load in a browser with no 404s
4. Commit the dist/ directory

## Architecture doc (MANDATORY)

Before your final commit, write an `ARCHITECTURE.md` describing what you built:
- System overview (1 paragraph)
- Key modules and what each does
- Data flow
- Key decisions you made and why

10-20 lines is enough. It proves you understand what you built.


## REQUIREMENTS.md (eval overview)

# Eval: Escape the Dungeon (Bare — No Framework)

## Purpose

Baseline comparison eval. The agent builds the same game as `escape-the-dungeon` but
**without the GAD framework**. No `.planning/` directory, no `gad` CLI, no `/gad:*` skills.

Instead, the agent is given a minimal AGENTS.md that instructs it to:
1. Research the "Ralph Wiggum loop" (plan-do-check-act for AI coding agents)
2. Create its own workflow artifacts and tracking format
3. Build reusable "skills" (documented patterns) when it encounters repeated problems
4. Iterate on its own process as it implements

This measures what an agent does *without* a structured framework — do they naturally
create tracking? How organized is their output? How does implementation quality compare?

## What this eval measures

1. **Requirement coverage** — same 12 criteria as escape-the-dungeon. Did the game get built?
2. **Workflow emergence** — did the agent create any tracking system? How structured was it?
   - Created task lists or checklists? (0.25)
   - Created state tracking / progress notes? (0.25)
   - Created architecture or design docs? (0.25)
   - Created reusable patterns / skills? (0.25)
3. **Implementation quality** — does the code compile, run, and produce a playable game?
4. **Iteration evidence** — did the agent revisit and improve its workflow during implementation?
   Score = (workflow_updates / total_phases). A score of 0 means "set it and forgot it."
5. **Time efficiency** — wall clock / token usage
6. **Human review** — playability, code quality, architecture soundness

## Game requirements (identical to escape-the-dungeon)

The game requirements are in `REQUIREMENTS.xml` in the template. They are the same 12
success criteria as the GAD version — same game, same scope, same deliverables.

## Comparison with escape-the-dungeon (GAD version)

After both evals are scored, compare:

| Dimension | Bare | GAD | Delta |
|-----------|------|-----|-------|
| requirement_coverage | ? | ? | GAD advantage? |
| workflow tracking | emergent | structured | how different? |
| per_task_discipline | ? | 0.83 | is GAD more disciplined? |
| time_efficiency | ? | 0.963 | faster or slower? |
| human_review | ? | ? | which game is more polished? |

The hypothesis: GAD provides structure that leads to better discipline and traceability,
but a skilled agent without a framework may produce equivalent or better code if it
develops its own process. This eval tests that hypothesis.

## Scoring

| Dimension | Weight | How scored |
|-----------|--------|-----------|
| requirement_coverage | 0.25 | Same 12 criteria as escape-the-dungeon |
| workflow_emergence | 0.20 | 4 sub-criteria scored 0-1, averaged |
| implementation_quality | 0.20 | Build succeeds + game runs + no critical bugs |
| iteration_evidence | 0.15 | workflow_updates / total_implementation_phases |
| time_efficiency | 0.05 | 1 - (duration / 480), clamped [0,1] |
| human_review | 0.15 | Human score via `gad eval review` |

When human_review is null, remaining weights normalize to sum to 1.0.



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