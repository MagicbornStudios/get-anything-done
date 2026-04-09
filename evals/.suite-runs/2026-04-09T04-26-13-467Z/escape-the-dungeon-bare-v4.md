# Eval: escape-the-dungeon-bare v4


**Mode:** greenfield | **Workflow:** bare



You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Agent guide — Escape the Dungeon (bare eval)

You are building a roguelike dungeon crawler game. Read `REQUIREMENTS.xml` for what to
build and `source-GAMEPLAY-DESIGN.xml` + `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` for the
game design.

## Project layout

Create the game under `game/`. Put ALL workflow/tracking/notes/decisions/skills files
under `game/.planning/`. Never mix them into source directories.

```
game/
├── .planning/     ← workflow, decisions, skills, notes — whatever format you like
├── src/           ← source code only
├── public/        ← assets
└── package.json, tsconfig.json, etc.
```

## How to work

You don't have a planning framework. Build the game however makes sense to you.
Track your work in `game/.planning/` using whatever format keeps you sane — checklists,
prose, JSON, whatever. Update it as you go so you can pick up where you left off if
you lose context.

You start with two inherited skills in `skills/`:

- **`create-skill.md`** — how to capture a working pattern as a reusable skill doc.
  Use this whenever you solve something non-obvious.
- **`find-sprites.md`** — how to source coherent visual assets so the UI doesn't fail
  the quality gate.

Copy them into `game/.planning/skills/` and use them. When you hit repeated problems,
write a new skill there using the `create-skill` pattern. That's how your workflow
evolves.

## Gates (all must pass or score 0)

See `REQUIREMENTS.xml` for the authoritative version. Summary:

- **G1 Game loop**: Title → New Game → room → navigate → combat → return → at least 3 room transitions, no softlock.
- **G2 Forge with ingenuity payoff**: Functional spell crafting AND at least one encounter per floor where the crafted/adapted spell provides a meaningful advantage. Loot-granted spells do NOT satisfy this gate.
- **G3 UI quality**: Icons, styled controls, HP/mana bars, room-type differentiation, sprite/portrait representation. Use the `find-sprites` skill. Raw ASCII fails.
- **G4 Pressure mechanics**: At least two systems (resource / counterplay / encounter design / build) that make baseline starter abilities insufficient to brute-force a floor. At least one must interact with the forge.

## Build and verify

```sh
cd game/
npm install
npm run dev        # verify in browser
npm run build      # production build to dist/
```

Test the full game loop after each phase of work. Don't wait until the end.

## UI assets

Use easily sourced assets: npm icon/sprite packages, free game art from web search,
generated SVG/canvas, or emoji. Make it look intentional, not like a debug console.

## Final deliverable

- `game/dist/` with a working `index.html`
- Full game loop playable in the browser when served via HTTP
- Whatever you put in `game/.planning/` to make the run reproducible

That's the contract. How you organize work and what artifacts you author beyond that
is yours to decide.


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