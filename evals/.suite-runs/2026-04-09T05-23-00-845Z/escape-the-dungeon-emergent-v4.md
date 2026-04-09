# Eval: escape-the-dungeon-emergent v4


**Mode:** greenfield | **Workflow:** emergent



You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Agent guide — Escape the Dungeon (emergent methodology)

You are building a roguelike dungeon crawler game. This is a continuation of a previous
run — you inherit its skills and lessons. Your job is to build on them.

## Start here

1. Read everything in the `skills/` directory from the template — these are patterns
   and failure notes from the previous run. Pay special attention to any files about
   what went wrong and how to fix it.
2. Copy those skills into `game/.planning/skills/` so you can evolve them in place.
3. Read `REQUIREMENTS.xml` and the source docs (`source-GAMEPLAY-DESIGN.xml`,
   `source-STAT-AND-BEHAVIOUR-TAXONOMY.md`).

## Project layout

Create the game under `game/`. Put ALL workflow/tracking/decisions/skills files under
`game/.planning/`. Never mix them into source directories.

```
game/
├── .planning/
│   ├── skills/         ← inherited + new skills you create
│   ├── CHANGELOG.md    ← what you changed from inherited skills
│   └── ... (any other workflow files you want)
├── src/                ← source code only
├── public/             ← assets
└── package.json, etc.
```

## How to work

You inherit a workflow from the previous run. Use it. Improve it. Fix anything that
didn't work last time. When you hit a new problem, write a new skill in
`game/.planning/skills/` immediately — not after the fact.

Track your work in `game/.planning/` using whatever format helps you stay organized.
At the end, write `game/.planning/skills/CHANGELOG.md` documenting what you changed
from the inherited set — that's how the next run learns.

## Bootstrap skills you always inherit

Every emergent run includes at least these two skills (in addition to any
domain-specific skills from previous runs):

- **`create-skill.md`** — how to capture reusable patterns as skill documents.
- **`find-sprites.md`** — how to source coherent visual assets so the UI doesn't fail
  the quality gate.

Read all inherited skills before writing code. Apply them, rewrite them in place when
they're wrong, delete them when they encode bad patterns, and write new ones with
`create-skill` whenever you solve a non-obvious problem.

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

Verify the game after each phase. Don't wait until the end — the previous run's failure
mode was accumulating bugs silently.

## UI assets

Use easily sourced assets: npm icon/sprite packages, free game art from web search,
generated SVG/canvas, or emoji. Make it look intentional.

## Final deliverable

- `game/dist/` with a working `index.html`
- Full game loop playable in the browser when served via HTTP
- `game/.planning/skills/CHANGELOG.md` — what you evolved from the inherited skills

Beyond that, the shape of `game/.planning/` is yours to decide.


## REQUIREMENTS.md (eval overview)

# Eval: Escape the Dungeon (Emergent Methodology)

## Purpose

Tests whether an agent's self-created development methodology improves over iterations.
Each run inherits skills and workflow artifacts from the previous bare/emergent run.
The agent is NOT given the GAD framework — it uses whatever system it built last time,
plus any improvements it wants to make.

## Hypothesis

An agent that can read and build on its previous workflow and skills will produce
progressively better results across runs. If true, this validates the concept of
emergent development methodology — the agent discovers effective patterns through
experience rather than being given them upfront.

## How it works

1. **v1**: Agent gets skills/workflow from `escape-the-dungeon-bare v1` (the first run)
2. **v2**: Agent gets skills/workflow from emergent v1 (whatever it improved)
3. **v3+**: Each run builds on the previous, accumulating and refining skills

The `skills/` directory in the template contains inherited artifacts. The agent is
told to read them, use what's useful, improve what's not, and add new skills when
it encounters new patterns.

## What this eval measures

1. **Requirement coverage** (0.25) — same 12 criteria, same gate rules
2. **Workflow quality** (0.15) — how well-structured is the tracking system?
   - Clear phase breakdown? Task tracking? State management?
3. **Skill reuse** (0.15) — did the agent actually USE inherited skills?
   - Read them? Referenced them? Applied the patterns?
   - Did it improve existing skills or just ignore them?
4. **Implementation quality** (0.15) — build works, game runs, no critical bugs
5. **Iteration evidence** (0.10) — did the agent update its workflow/skills during work?
6. **Time efficiency** (0.05) — wall clock / tokens
7. **Human review** (0.15) — playability, polish, code quality

## Comparison across all three conditions

| Condition | Framework | Skills | Tracking |
|-----------|-----------|--------|----------|
| GAD (escape-the-dungeon) | Full GAD framework | Pre-built skills | .planning/ XML |
| Bare (escape-the-dungeon-bare) | None | Creates from scratch | Whatever agent makes |
| Emergent (this eval) | None | Inherited from previous run | Evolves across runs |

The question: does emergent methodology converge toward GAD-level quality over iterations?
At what point does it plateau? Does it ever surpass GAD?

## Game requirements

Same REQUIREMENTS.xml as escape-the-dungeon and escape-the-dungeon-bare. Same 12 success
criteria, same gate rules, same vertical-slice priority.



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