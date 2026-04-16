# Todo: site-as-project-template

**Captured:** 2026-04-16
**Area:** site / architecture / planning
**Urgency:** high

## What

Every GAD project ships with a site. The current site IS the template. The /planning route's tabs and components need to be reorganized so they belong to the project/species/generation model, not just the global GAD view.

### Tab-by-tab audit (from user review):

**Evolution tab** — KEEP. Good as-is. Proto-skills need to be reviewable in the editor too (link from DNA Editor to evolution tab content, or embed inline).

**Planning tab** (tasks, decisions, roadmap, requirements, notes) — these belong to ALL GAD projects as read-only views. The coding agents run in the background on servers; these views show the planning state. Requirements aren't showing on this page currently — needs investigation.

**System tab** — real-time logging (if available), real-time token usage, real-time session data. The site should make requests to the CLI (`gad` commands) for live data, same pattern as the editor's command bridge. This overlaps with the battery bar concept.

**Visual Context Panel** — exit icon sometimes hidden behind scroll bars in the inspector. Need Ctrl+hover to show exit on disabled directional input at footer.

### Architectural direction:

1. /planning route components become reusable project-scoped views
2. Remove redundant/useless info, keep: top files, top skills, tool mix, human review, workflow graphs
3. Workflow graphs are marketing-grade — they go on the distributable landing page copy
4. Each project's site compiles from the sink (already designed in gad-206)
5. The site IS the product — not a dashboard bolted on

### Sprite system:

- Standard prompts for generating sprite sheets (paste into Midjourney/DALL-E/etc)
- Generated images immediately usable in the editor
- Performance animations from sprite sheets
- Media reference system ties into `C:\Users\benja\Desktop\vcs_image` staging

## Why

Phase 44.5 built the editor. The next step is making the site work AS the product — not just a dev tool. The /planning route's content is the prototype for what every project's dashboard looks like.

## Context

- Phase 44.5 complete (22 tasks)
- Decision gad-206: species = evolutionary branches
- Todo media-service-infra already captured (media storage, token tracking)
- The /planning route has Evolution, Planning, System, Workflows tabs
- Requirements not rendering on /planning — needs investigation

## Suggested next action

Discuss-phase for "site-as-project-template" restructuring. Audit /planning route component inventory. Map which components move to project-scoped views vs stay global. Investigate requirements rendering bug.
