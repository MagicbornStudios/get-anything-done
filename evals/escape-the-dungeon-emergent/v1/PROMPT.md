# Eval: escape-the-dungeon-emergent v1


You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Agent guide — Escape the Dungeon (emergent methodology)

You are building a roguelike dungeon crawler game. This is a continuation of a previous
attempt. You have inherited skills and a workflow from the last run — read them first.

## Before you start coding

1. **Read `skills/previous-workflow.md`** — learn what worked and what failed last time.
2. **Read all files in `skills/`** — these are reusable patterns from the previous run.
3. **Read `REQUIREMENTS.xml`** — what you're building. Same game, same requirements.
4. **Read the source docs** — `source-GAMEPLAY-DESIGN.xml` and `source-STAT-AND-BEHAVIOUR-TAXONOMY.md`.
5. **Create or update your workflow** — based on what you learned from the previous run's failures:
   - The last run produced a main menu but the game didn't start when clicking New Game.
   - The last run wrote everything in 1 commit with no verification between phases.
   - Fix these problems in your workflow before you start coding.

Write your workflow to a file (e.g. `WORKFLOW.md`) and ACTUALLY UPDATE IT as you work.

## During implementation

- **Use your inherited skills.** The `skills/` directory has patterns from the last run. Use them.
- **Verify after each phase.** The last run didn't verify and bugs accumulated silently. After each phase, run the game and confirm it works. If something breaks, fix it before moving on.
- **Create new skills when you hit problems.** If you encounter a new pattern or fix a tricky bug, write it down in `skills/` immediately — not after the fact.
- **Update existing skills if they're wrong.** If an inherited skill doesn't work or could be better, update it.
- **Commit after each phase at minimum.** The last run had 1 giant commit. Do better.
- **Test the New Game flow early.** The last run's main menu rendered but New Game didn't work. Make sure the full flow works: title → new game → room → interaction.

## What you are NOT given

- No planning framework or CLI tools
- No pre-built task tracking system (but you have the previous run's workflow as reference)
- You ARE given skills from the previous run — use and improve them

## Build and verify

```sh
cd game/
npm install
npm run dev        # dev server — USE THIS to verify each phase
npx tsc --noEmit   # type check
npm run build      # production build
```

**IMPORTANT:** After each phase, run `npm run dev` and open the browser to verify the game works. Do NOT wait until the end to check. The last run's fatal flaw was never verifying during implementation.

## Final deliverable (MANDATORY)

1. Run `npm run build` in `game/` — must succeed with zero errors
2. `game/dist/` must contain a playable `index.html`
3. The game must have: title screen → new game → room navigation → at least one interaction
4. Commit the dist/ directory

## Architecture doc (MANDATORY)

Write `ARCHITECTURE.md` — system overview, key modules, data flow, decisions. 10-20 lines.

## Skill evolution

After completing the game, review your skills:
- Which inherited skills did you actually use?
- Which did you improve?
- What new skills did you create?
- Write a `skills/CHANGELOG.md` documenting what changed and why.

This changelog is how the next run learns from your experience.


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