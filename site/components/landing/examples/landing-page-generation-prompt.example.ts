/**
 * Example-only prompt shown in the landing visual-context demo.
 * Keep reusable CRUD prompt templates under `site/public/devid-prompts/`.
 */
export const LANDING_PAGE_GENERATION_PROMPT = `Objective: update target component.
Route: **http://localhost:3000/**
Skill ref (mandatory): vendor/get-anything-done/skills/gad-visual-context-system/SKILL.md

Target:
- wrapper: SiteSection (band dev panel)
- cid: agent-handoff-cycle-site-section
- search: cid="agent-handoff-cycle-site-section"
- data-cid: agent-handoff-cycle-site-section
- inner landmarks: Identified as="LandingAgentHandoffCycle" | "AgentHandoffCycleCopy" | "AgentHandoffCycleMedia" | "AgentHandoffCycleDiagram"
- scope: \`AgentHandoffCycle.tsx\` + \`AgentHandoffCycleDiagram.tsx\` (SVG cycle + embedded terminal image) + \`agent-handoff-cycle-constants.ts\` + \`AgentHandoffCycleMedia.tsx\` + \`landing-page-generation-prompt.example.ts\`

Cycle to showcase (rinse · repeat):
1. Browse site with dev IDs — see greppable \`cid\` / \`data-cid\`.
2. Visual Context Panel → quick prompt scaffold for the hovered band.
3. Speech + CRUD verbs — capture rich intent without retyping route + tokens.
4. Clipboard — structured handoff in one copy.
5. Coding agent (Claude Code, Cursor, Codex, …) — paste, agent executes.
6. Ship → return to site → same loop on the next band.

Execution model:
- Default: subagent.
- Subagent scope: target component plus tightly related nearby components in the same UI context.
- If work expands beyond local UI context, keep orchestration in main session and delegate isolated slices only.

Control flow (subagent reuse):
<workflow name="subagent-reuse">
  <branch if="matched_subagent_exists_and_same_or_similar_ui_context">
    <output>Reuse matched subagent via \`send_input\` with \`interrupt=true\`.</output>
  </branch>
  <branch if="user_says_new_lane">
    <output>Spawn new subagent lane.</output>
  </branch>
  <else>
    <output>Spawn one subagent for this UI area.</output>
  </else>
</workflow>

Report:
- workflow: subagent | local-session
- rationale: one line
- preserve route/as/search/data-cid

Reference image (editorial — terminal handoff):
https://storage.ghost.io/c/57/9b/579b6dca-f48a-4307-844f-f0533595d058/content/images/2025/10/Chatting-with-Claude-Code.png

Tasking (update):

Ship a **presentable cyclical flow** for this band: SVG elliptical arrows connecting six steps; the Claude Code screenshot lives **inside** the coding-agent node (not a duplicate hero column). Mobile: vertical stack with the same image in-step. Right column = short upstream context + YouTube link only.`;
