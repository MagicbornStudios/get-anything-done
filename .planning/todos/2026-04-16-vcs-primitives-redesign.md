# VCS Primitives Redesign — Universal Method Research

**Source:** Session 2026-04-16c (decision gad-223)

## Core question

What is the absolute minimal instrumentation for agent-addressable UI
that works across ANY renderer (React, canvas, terminal, game engine)?

## Current approach (site-specific)

- `<SiteSection cid="...">` — structural wrapper component
- `<Identified as="...">` — inner landmark wrapper component
- `<DevPanel>` / `<BandDevPanel>` — floating inspection overlays
- `<SectionRegistry>` — lists all IDs on current page

## Problems

- Component wrappers couple VCS to React
- Panels are visual noise (always present)
- SiteSection is structural — may not map to games/canvas
- Identified adds a wrapper div that can break layouts

## Research directions

1. **Bare data attributes** — just `data-cid="name"` on any element, no wrapper
   - Pro: zero coupling, works in any JSX
   - Con: no automatic registration, need a scan
   
2. **Naming convention + scan script** — grep-findable literals, no components
   - Pro: universal across renderers
   - Con: no runtime interactivity (no panel, no click-to-copy)

3. **Keyboard-toggled overlay** — panel only appears on hotkey, not persistent
   - Pro: zero visual noise in normal dev
   - Con: less discoverable

4. **Registry as a standalone script** — `gad vcs scan` that finds all IDs
   - Pro: works offline, no runtime dependency
   - Con: stale if source changes

## Hypothesis

The universal method is: string literal constants + a scan tool + an optional
runtime overlay. The components (SiteSection, Identified) are React convenience
sugar on top. The scan tool IS the VCS — it finds IDs from source and maps
them to built output locations.

## Test plan

1. VCS test species on escape-the-dungeon (KAPLAY canvas game)
2. Try approach: just string constants registered in a Map + keyboard overlay
3. Compare: does this work as well as the React component approach?
4. If yes: the primitives are the convention + scan, not the components

## Next step

Run the VCS test species and observe what the agent builds.
