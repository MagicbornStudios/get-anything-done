---
id: dd-001
title: "VCS bands click-blocking — switch to highlight-only"
problem: "Per-section BandDevPanel hover overlay intercepted clicks; operator could not select section content"
reasoning: "Hover-mount with pointer events was the wrong default. Power users want it; everyone else needs to click through. Inverting the default keeps the primitive available without forcing it."
fix: "Added bandPanelMode prop to DevIdProvider; default 'highlight-only'; SiteSection renders pointer-events:none ring; active cid surfaces in unified DevPanel."
principle: "Optional dev-tools must default to non-blocking. Inverted default + opt-in for power users beats one-mode-fits-all."
refs: ["GLOBAL-D-322","35-35","packages/visual-context/src/devid/DevIdProvider.tsx"]
status: live
created_at: 2026-05-08T00:00:00Z
---

# VCS bands click-blocking — switch to highlight-only

## Problem

The BandDevPanel was mounted as a hover overlay on every `SiteSection` with full pointer events.
This meant any click within a section was intercepted by the invisible dev panel, not the actual content.
Operator reported inability to select text, click links, or interact with anything inside sections.

## Root Cause

`pointer-events: auto` was the default on the band overlay because the initial design assumed
dev-panel interaction (hover-to-see-cid) was the primary use case. In practice, viewing a site
and interacting with content is primary; inspecting cids is secondary.

## Fix

Introduced `bandPanelMode: 'highlight-only' | 'interactive'` on `DevIdProvider`.
- Default: `'highlight-only'` — ring renders with `pointer-events: none`, clicks pass through.
- Opt-in `'interactive'` — original behaviour, overlay catches events for click-to-copy-cid.
`SiteSection` reads the mode from context and applies the correct class.

## Related

- Decision GLOBAL-D-322 (design-decisions corpus)
- Task 35-35 (VCS highlight-only fix)
- `packages/visual-context/src/devid/DevIdProvider.tsx`
