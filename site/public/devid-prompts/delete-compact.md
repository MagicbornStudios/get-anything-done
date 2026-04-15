Delete target.
Route: {{PAGE_URL}}
Target: {{COMPONENT_TAG}} | {{LABEL}}
search: {{SEARCH_LITERAL}}
data-cid: {{CID}}

<workflow name="subagent-reuse">
  <branch if="matched_subagent_exists_and_same_or_similar_ui_context">
    <output>Reuse matched subagent via `send_input` with `interrupt=true`.</output>
  </branch>
  <branch if="user_says_new_lane">
    <output>Spawn new subagent lane.</output>
  </branch>
  <else>
    <output>Spawn one subagent for this UI area.</output>
  </else>
</workflow>

Cleanup: remove dead imports/components; typecheck touched package.
