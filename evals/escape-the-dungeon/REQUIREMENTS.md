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

## Source material

- `source-GAMEPLAY-DESIGN.xml` — full gameplay design (500+ lines of XML)
- `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` — canonical stat names and engine mappings
- `template/.planning/REQUIREMENTS.xml` — structured requirements derived from source docs

## Human review

After the eval agent completes, a human reviews:
- Does the game feel playable?
- Does navigation work intuitively?
- Are the UI surfaces clear?
- Is the content-driven architecture sound?

This is a manual score added to SCORE.md after the eval run.
