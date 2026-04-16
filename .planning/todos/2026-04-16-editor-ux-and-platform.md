# Todo: editor-ux-and-platform

**Captured:** 2026-04-16
**Area:** ui / platform / editor / infra
**Urgency:** high

## What

Multiple UX and platform gaps surfaced during session review:

### 1. Skill installation to project DNA — no workflow exists
User can't install skills to a project's DNA from the editor. Need a clear workflow:
- Browse available skills (from catalog or external)
- Install to project (adds to species config `installedSkills`)
- See installed skills in DNA Editor per species
- Try skills via `gad try` from the editor UI

### 2. Project selector is bare
The `/projects/edit` index page is a plain list. Needs:
- Visual cards with project images/gradients
- Quick-launch: play games / use apps directly from the selector
- Steam client-like library view for published generations
- Filter by domain (game, site, cli, etc.)

### 3. Game/app player mode
Users want to just play their games or use their apps. Need a "library" or "arcade" view:
- Grid of playable generations
- Launch in iframe or new tab
- Not editing mode — consumption mode
- Like a Steam library for GAD generations

### 4. Conversational context capture at project/species/generation level
Long conversations about a project need to be captured:
- Quick prompts with VCS identity capture (landmark + speech)
- Conversation threads per project/species/generation
- Component identification must work regardless of how project was generated
- VCS components need to be reusable across any React project

### 5. VCS as installable npm package
The Visual Context System (SiteSection, DevPanel, Identified, etc.) should be:
- Extracted into a standalone npm package
- npx/dlx installable (not published to npm registry)
- Reusable in any React project, not just the GAD site
- Showcase all code on the landing page

### 6. Settings surface
Projects need configurable settings:
- AI API keys (for tweakcn integration, generation runs)
- Display preferences
- Editor preferences
- Per-project overrides

### 7. tweakcn integration
GitHub: https://github.com/jnsahaj/tweakcn
- AI-powered theme tweaking for shadcn/tailwind
- Requires AI API key (Google Gemini default, but OpenAI should work)
- Integrate into landing page so users can tweak the look in real-time
- Would need a settings surface for the API key

## Why

The editor ships CRUD but lacks the workflow for actually USING it as a project management tool. Users can't install skills, play their games, or have persistent conversations about their projects. The VCS is powerful but locked to this one site — making it installable multiplies its value.

## Context

- Phase 44.5 complete (22 tasks), phase 45 wave 2 complete (12 tasks)
- DNA Editor exists but only shows/manages existing skills — no install workflow from editor
- PreviewFrame exists (device toggle iframe) — foundation for game/app player
- VCS components are ~2500 LOC across ~20 files in site/components/devid/
- tweakcn is a third-party tool, MIT licensed, uses AI to generate theme variations

## Suggested next action

Break into phases:
- Phase 46: Editor workflow completion (skill install, project selector upgrade, game library)
- Phase 47: VCS extraction as npm package + tweakcn integration
- Phase 48: Conversational context system (threads per project/species/generation)
