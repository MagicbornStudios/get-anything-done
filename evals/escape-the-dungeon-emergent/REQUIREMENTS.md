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
