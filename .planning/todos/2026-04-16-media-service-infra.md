# Todo: media-service-infra

**Captured:** 2026-04-16
**Area:** infra / data / ui
**Urgency:** high

## What

Five interconnected infrastructure items for the editor and service mode:

1. **Media storage system** — `C:\Users\benja\Desktop\vcs_image` as local staging folder. Serve via `/api/dev/media` or similar route. Species cards, bestiary entries, recipes, and marketplace listings all need image support. `project.json` already has `cardImage`/`heroImage` fields (null everywhere). Wire them to actual media.

2. **API/token usage tracking with limits** — for offering GAD as a service. Track token consumption per project/species/generation run. Set configurable limits. Real-time display in editor.

3. **Real-time context management** — battery bar / gauge showing how much context is loaded for the current project/species/generation. Visible in editor toolbar. Helps operator understand context budget before launching a generation.

4. **Generation editing (self-mutation)** — edit the source of an existing generation rather than running a new one from scratch. Reuses the epigenetics/expression system. Like a Frankenstein or Hulk pattern: take an existing generation, mutate specific parts, produce a variant. Not just config — actual source editing.

5. **Drag-and-drop recipes into species deck** — recipes in the left pane should be draggable onto the center species deck canvas. Dropping creates a draft species from the recipe template. Draft state is visible before committing.

## Why

The editor is functionally complete for config CRUD but has no visual richness (no images on cards), no resource awareness (no context/token gauges), and no drag-and-drop workflow for the recipe-to-species pipeline. These are the gaps between "developer tool" and "usable product."

## Context

- Session shipped 13 tasks across 44.5 (data layer, file API, inline editing, preview frame, VCS improvements)
- `project.json` already has `cardImage`/`heroImage` fields — just null everywhere
- Species deck is the center canvas in ProjectEditor (currently ProjectCanvas.tsx)
- Bestiary needs search/filter (mentioned alongside these items)
- User explicitly mentioned `C:\Users\benja\Desktop\vcs_image` as the media staging path

## Suggested next action

Create a new phase (45.5 or 46) for "Editor media + service infrastructure." Items 1 and 3 are prerequisites for items 2 and 4. Item 5 depends on recipe CRUD (44.5-06) landing first. Battery bar (item 3) could ship as a standalone task in the current phase since it's UI-only.
