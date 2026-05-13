# Workflow: Subagent Default Cost Discipline

## Inputs
- Task scope definition (bounded vs open-ended)
- Decision about which model tier to use for subagents

## Steps
1. **Classify the task**: is it mechanical/bounded (implement X, write Y, fix Z in file W) or synthesis/orchestration (design architecture, pick between approaches, reason across many contexts)?
2. **Mechanical/bounded → Sonnet or Haiku**: dispatch as subagent at the cheapest tier that can do it correctly. Default: Sonnet. Only drop to Haiku if the task is truly rote.
3. **Synthesis/orchestration → Opus in main thread**: this is the current agent's job, not a subagent's. Reserve Opus reasoning for cross-context synthesis, not file edits.
4. **Dispatch 3-5 subagents in parallel** for independent work-streams. Sequential single-agent work for bounded tasks is a ~5x cost premium for no quality gain.
5. **Never dispatch Opus subagents for mechanical work**: file writes, formatting, grep-and-replace, test fixes, config edits. These are Haiku work.
6. **Check after dispatch**: did all subagents produce correct output? If a Sonnet subagent produced poor quality on a bounded task, that's a scope-definition problem — tighten the spec, don't upgrade the model.

## Verification
- Subagent dispatch log shows Sonnet/Haiku for implementation tasks
- Opus usage confined to main-thread orchestration turns
- Multiple independent subagents running in parallel, not sequential

## Failure modes
- **Opus subagent for mechanical task**: 10-20x cost premium, no quality gain.
- **Sequential single subagent**: serializes work that could parallelize; same cost as parallel but N× slower.
- **Upgrading model instead of fixing spec**: if Sonnet "can't do it," the prompt is underspecified — fix the prompt.
