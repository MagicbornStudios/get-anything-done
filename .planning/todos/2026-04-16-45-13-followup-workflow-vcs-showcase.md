# 45-13 follow-up — workflow visualization + VCS showcase on Overview tab

**Date captured**: 2026-04-16
**Parent task**: 45-13 (landing composition, shipped pragmatic cut)

## The idea

45-13 spec called for five things on the Overview tab rewrite:
- ✓ stats bar
- ✓ human review scores (inside stats bar)
- ✓ findings as whitepaper cards (satisfied by promoting the existing
  `ProjectFindingsSection` above Requirements — already card-style via
  `ProjectFindingArticle`)
- ⏸ **workflow visualizations** — deferred
- ⏸ **VCS showcase** — deferred

Both deferred items deserve their own scope. Forcing them inline with the
composition rewrite risked spiralling a visible-content sprint into a
custom-visualization build-out mid-flight.

## Workflow visualization

A graphic showing the gad loop (`snapshot → pick → implement → update docs
→ commit`) OR the project's specific workflow if it defines one. Likely
candidates:

- Mermaid diagram embedded in the Overview tab.
- Custom SVG flow component (like the how-it-works loop step diagram).
- Reuse of the `PlanningWorkflowsTab` content scoped to this project's
  workflow key.

Needs: design pass (what's the right abstraction for a project-level
workflow? is it the gad-loop generic, or a project-specific flow derived
from the project's own `workflow` field?).

## VCS showcase

A panel or inline screenshot demonstrating the Visual Context System
(decision gad-214, gad-216). Shows:
- A section with a data-cid label visible.
- The `Compass` or similar landmark overlay.
- A "ctrl+click any element to inspect" callout.

Needs: a reliable way to render a representative VCS demo without
requiring the live editor to be mounted on the public page (the VCS
UI is dev-only today).

## When to do it

After 45-14 (type ramp + palette) lands — the workflow visualization
especially benefits from the refreshed visual identity. If the palette
work reveals that the current stats bar needs visual polish, fold that
into the same pass.
