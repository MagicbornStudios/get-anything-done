# VCS live showcase — three scripted client-side demos

**Date captured**: 2026-04-16
**Decision**: gad-232 (three-demo spec, deterministic, client-side)
**Supersedes**: "VCS showcase" entry in `2026-04-16-45-13-followup-workflow-vcs-showcase.md`

## Goal

A landing-page band that demonstrates the Visual Context System by
playing three scripted demos — no LLM calls at runtime, no backend.
Operator clicks a recorder icon; each demo plays its prompt text and
then executes a deterministic UI effect.

## Demos

### Demo 2 — Component manipulation (mandatory, simplest)

Prompt: "remove this element."
Effect: a specific demo element is highlighted, then fades + slides out.
Context panel updates to reflect its removal.
Implementation: React state + CSS transition + pre-mapped target
element. ~40 lines.

### Demo 3 — Self-referential VCS discovery (mandatory)

Prompt: "I want to be able to identify elements on the screen by
clicking and have a list of available ones show here."
Effect: a list panel slides in; clicking any of a set of demo elements
adds its `data-cid` to the list. Pure client-side state.
Implementation: one container with a click handler that pushes clicked
element cids into a list. ~30 lines.

### Demo 1 — Character on tileset (conditional)

Prompt: "move up and then go left."
Effect: a sprite character moves up then left across a static tileset
via CSS animation. Optional heuristic + client-side semantic similarity
step that resolves the prompt string to the direction pair.
Implementation: sprite sheet + CSS `steps()` animation + pre-baked path.
Conditional: **only ship if a sprite sheet and ~50 lines of client code
get it done.** If it starts ballooning, skip and ship demos 2+3 only.

## Shared UI

- Recorder icon (top-left of the showcase band).
- Prompt reveal: types the prompt string out in a monospace bubble
  before the effect plays (or TTS if easy, text animation is fine).
- One demo at a time; cycle button to advance.
- Everything in one component, one file, no new deps.

## Placement on landing

Between `LandingVisualContextAndPromptBand` and `PlayableTeaser` on
`site/app/page.tsx`. Replaces the current visual-context band's
section-level epigraph divider with a full demo band.

## Not in scope

- Live LLM integration. The demos are intentionally deterministic to
  keep the page static-servable and fast.
- Editor mode integration. This is public-landing show-and-tell, not a
  hands-on editor.

## Dependencies

- Asset pipeline (ai-asset-generation-pipeline todo) for demo 1's
  sprite sheet IF we ship it.
- tweakcn-integration (optional) if we want the demo to pick up the
  new palette visually before 45-14 ships.
