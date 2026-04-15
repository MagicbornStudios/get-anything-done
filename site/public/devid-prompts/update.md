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

Report:
- workflow: subagent | local-session
- rationale: one line
- preserve route/as/search/data-cid

Tasking (update):
