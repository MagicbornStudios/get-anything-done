Objective: update target component.
Route: **{{PAGE_URL}}**
Skill ref (mandatory): {{VISUAL_CONTEXT_SKILL_REF}}

Target:
- wrapper: {{COMPONENT_TAG}}
- as: {{LABEL}}
- search: {{SEARCH_LITERAL}}
- data-cid: {{CID}}
- scope: target node + children

Execution model:
- Default: subagent.
- Subagent scope: target component plus tightly related nearby components in the same UI context.
- If work expands beyond local UI context, keep orchestration in main session and delegate isolated slices only.

Control flow (subagent reuse):
<workflow name="subagent-reuse">
  <step id="match-context">Match existing subagent by same route and similar UI context (`as`, `cid`, section wording).</step>
  <branch if="user_says_new_lane">
    <output>Spawn new subagent lane.</output>
  </branch>
  <branch if="matched_subagent_exists">
    <output>Reuse matched subagent via `send_input` with `interrupt=true`.</output>
  </branch>
  <else>
    <output>Spawn one subagent for this UI area.</output>
  </else>
</workflow>

Report:
- workflow: subagent | local-session
- rationale: one line
- preserve route/as/search/data-cid

Tasking (update):
