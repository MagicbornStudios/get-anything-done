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
