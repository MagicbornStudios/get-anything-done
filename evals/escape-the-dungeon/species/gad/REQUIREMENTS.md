# Eval: Escape the Dungeon

## What this eval measures

1. **Skill trigger accuracy** — are /gad:* skills triggered at the right moments (discuss before plan, plan before execute, verify after execute)
2. **Planning quality** — does the agent produce coherent phases, tasks, decisions from a complex game design doc
3. **CLI context efficiency** — does gad snapshot/context deliver what the agent needs without reading dozens of files
4. **End-to-end loop** — does the full GAD loop (discuss → plan → execute → verify → score) work on a real implementation
5. **Time-to-completion** — wall clock and token counts from requirements to working game

## Eval flow

1. Pre-planning discussion: `/gad:discuss-phase` — collect open questions, clarify requirements, record the conversation
2. Phase planning: `/gad:plan-phase` — break the game into implementable phases with tasks
3. Execution: `/gad:execute-phase` — implement each phase, update planning docs, commit
4. Verification: `/gad:verify-work` — check each phase against its definition of done
5. Scoring: TRACE.json + SCORE.md produced at end

## Hosted demo and source (portfolio site)

A **production build** of the game can be copied into the **custom_portfolio** repo at `apps/portfolio/public/evals/escape-the-dungeon/` so it is served at **`/evals/escape-the-dungeon/`** (playable in the browser). **Game source** lives in this repo under **`evals/escape-the-dungeon/game/`** (Vite + TypeScript + Kaplay). Traces and scores remain under `evals/escape-the-dungeon/vN/`.

## Source material

- `source-GAMEPLAY-DESIGN.xml` — full gameplay design (500+ lines of XML)
- `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` — canonical stat names and engine mappings
- `template/.planning/REQUIREMENTS.xml` — structured requirements derived from source docs

## Human review

After the eval agent completes, a human opens the build output (`gad eval open escape-the-dungeon`)
and scores it 0.0-1.0 via `gad eval review`. The rubric:

| Score | Meaning |
|-------|---------|
| 0.0 | Blank screen, nothing renders |
| 0.1-0.3 | Something renders but not playable (menus don't work, can't start game) |
| 0.4-0.6 | Playable vertical slice — can start game, navigate, have one interaction |
| 0.7-0.8 | Multiple interactions work, UI is functional, core loop is playable |
| 0.9-1.0 | Polished, all major systems present and working, feels like a real game |

**Gate:** If the build output shows a blank screen, `requirement_coverage` is overridden to 0
regardless of what the automated trace says. Code that doesn't render has zero coverage.

## v5 finding

v5 scored auto_composite 0.955 but human_review 0.0 (blank screen). The agent built systems
code but no visible UI. Requirements updated to mandate UI-first build order and a playable
vertical slice as the primary success criterion.
