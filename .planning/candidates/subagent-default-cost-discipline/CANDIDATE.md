# Candidate: subagent-default-cost-discipline

## Source
Evolution scan 2026-05-09, today's parallel subagent dispatch pattern.

## Observation
Agents default to Opus for all subagents out of habit or "safety." Mechanical tasks (file writes, test fixes, config edits) don't improve with Opus but cost 15× more per token than Haiku. Standing rule exists in memory but not as a loadable skill.

## Hypothesis
If Sonnet/Haiku is the default for bounded-scope subagents and Opus is reserved for main-thread orchestration, session costs drop significantly with no quality regression on mechanical work.

## Evidence
- `memory/feedback_subagent_default_even_for_claude.md`
- `memory/feedback_offload_to_cheaper_models.md`
- Today's validated dispatch pattern
