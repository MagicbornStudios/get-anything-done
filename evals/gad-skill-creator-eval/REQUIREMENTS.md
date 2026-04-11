# Eval: gad-skill-creator-eval

## What this eval measures

1. **Skill trigger accuracy** — are /gad:* skills triggered at the right moments
2. **Planning quality** — coherent phases, tasks, decisions from requirements
3. **CLI context efficiency** — gad snapshot delivers what the agent needs
4. **End-to-end loop** — discuss → plan → execute → verify → score
5. **Time-to-completion** — wall clock and token counts

## Eval flow

1. Pre-planning: `/gad:discuss-phase` — collect open questions, clarify requirements
2. Planning: `/gad:plan-phase` — break into implementable phases with tasks
3. Execution: `/gad:execute-phase` — implement, update planning docs, commit
4. Verification: `/gad:verify-work` — check against definition of done
5. Scoring: TRACE.json + SCORE.md

## Human review

After eval agent completes, human reviews output quality.
Manual score added to SCORE.md.
