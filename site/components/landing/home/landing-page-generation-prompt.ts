/**
 * Canonical example prompt for visual-context–driven landing updates.
 * Shown verbatim on the home route as a grep-friendly handoff literal.
 */
export const LANDING_PAGE_GENERATION_PROMPT = `Objective: update target component.
Route: **http://localhost:3000/**
Skill ref (mandatory): vendor/get-anything-done/skills/gad-visual-context-system/SKILL.md

Target:
- wrapper: SiteSection (band dev panel)
- cid: evolution-site-section
- search: cid="evolution-site-section"
- inner landmark: Identified as="LandingEvolutionBand" → search: as="LandingEvolutionBand"
- scope: target section + children

Execution model:
- Default: subagent.
- Subagent scope: target component plus tightly related nearby components in the same UI context.
- If work expands beyond local UI context, keep orchestration in main session and delegate isolated slices only.

Report:
- workflow: subagent | local-session
- rationale: one line
- preserve route/as/search/data-cid

Tasking (update):

Rebuild the entire landing route: restore a visible playable archive, narrate the evolutionary framework (including shedding proto skills), surface the Windows installer with a path for steady updates without asking visitors to track our development repository, pair that with the upstream GSD stream recording and a link to the GSD project repository (not ours). Add a section on visual-context identities, search tokens, UI/UX and software-development design patterns, and the workflow where the visual-context panel accepts Web Speech dictation into a CRUD-oriented quick prompt. Use this full prompt block as the on-page example that demonstrates what the system can do for landing-page generation.`;
