---
status: proto
workflow: ./workflow.md
description: Dispatch Sonnet/Haiku for bounded-scope subagents; reserve Opus for orchestration only
triggers:
  - dispatching subagents
  - parallel agent work
  - model tier selection
  - cost optimization
---

# Subagent Default Cost Discipline

## When to use
Every time you dispatch a subagent. Model tier selection is a cost decision with no quality tradeoff on bounded tasks — mechanical work does not improve with Opus.

## Why this matters
Today's parallel subagent dispatch pattern validated the rule: Sonnet for implementation, Opus for orchestration. Operator standing rule (memory `feedback_subagent_default_even_for_claude.md`): dispatch subagents by default for any bounded work; use Opus only for synthesis/orchestration. The cost ratio between Haiku, Sonnet, and Opus is roughly 1:5:15 per token. Dispatching Opus for file writes or test fixes burns 15× for zero quality gain. Over a session with 20 bounded subagent calls, the overcharge is material.

## Triggers
- "dispatching a subagent"
- "parallel agent work"
- "which model for this subagent"
- "subagent cost review"

## Success criteria
- Mechanical/bounded tasks use Sonnet or Haiku
- Opus usage confined to main-thread orchestration
- Independent work-streams parallelized (3-5 subagents concurrently)
- Poor subagent output traced to spec quality, not model tier

## Anti-patterns
- Opus subagent for file writes, test fixes, config edits
- Sequential single subagent for tasks that could parallelize
- Upgrading model tier instead of fixing underspecified prompt
- Defaulting to Opus "to be safe" on any subagent

## See also
- `memory/feedback_subagent_default_even_for_claude.md`
- `memory/feedback_offload_to_cheaper_models.md`
- CLAUDE.md workflow-discipline rule 1 (subagents are SOP)
