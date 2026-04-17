# AI asset generation pipeline — scripts + prompts for site/eval art

**Date captured**: 2026-04-16
**Decision**: gad-230 (palette: black/gold/maroon/red, gilded/shiny, sleek)
**Related**: GAD already does this pattern for skill authoring — mirror that.

## Goal

Parallel to the existing skill-authoring pipeline (prompt template →
`gad` CLI → artifact), add a script surface for generating visual
assets (sprites, icons, backgrounds, favicons) in the gad-230 palette
direction.

## Shape

`gad asset generate <kind> <slug> [--style <preset>] [--prompt-override "..."]`

Kinds: `sprite`, `icon`, `background`, `favicon`, `og-image`,
`tileset`, `avatar`.

Each kind has a **prompt template** that bakes the aesthetic direction:
black-dominant, gold/maroon/red accents, gilded-shiny finish,
non-typical, sleek. Template gets filled with kind-specific variables
(size, subject, mood).

Output: asset file under `site/public/generated-assets/<kind>/<slug>.png`
(or SVG where appropriate) + a sidecar `<slug>.prompt.json` with the
full prompt + model + seed so a re-generation is reproducible.

## Providers

Start with one provider (likely OpenAI image API or Stability) — same
hinge point as the tweakcn OpenAI tweak (gad-231). Factor the provider
call into a thin adapter so swapping is one file change.

## Not in scope

- Auto-placement of generated assets into components. That's manual.
- Animation generation. Sprites that animate can use multiple static
  frames + CSS `steps()` per decision gad-211.
- Background/ambient video. Out of scope until there's a clear need.

## First use cases

1. Logo + favicon refresh (task 45-17) — evolutionary helix / phylogeny
   tree in the gad-230 aesthetic.
2. OG image for the landing page (evolutionary Sun Tzu quote + gold
   accent overlay).
3. Character sprite for the VCS showcase demo 1 (decision gad-232) —
   only if that demo actually ships.
