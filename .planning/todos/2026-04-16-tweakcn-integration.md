# tweakcn theme generator — stand up + integrate

**Date captured**: 2026-04-16
**Decision**: gad-231 (adopt tweakcn), gad-230 (palette direction: black/gold/maroon/red, gilded)
**Source**: https://github.com/jnsahaj/tweakcn

## Goal

Get tweakcn running so the operator can generate themes in the
black/gold/maroon/red gilded aesthetic and export them into
`site/app/globals.css` as CSS variables.

## Path A — standalone (committed)

1. Clone or submodule tweakcn under `tmp/tweakcn/` (or `vendor/`).
2. Install + run locally — confirm it launches.
3. If AI theme generation via OpenAI needs tweaking (operator flagged),
   document the tweak (API key env var, endpoint override, etc.).
4. Operator generates first theme in the gad-230 aesthetic.
5. Export the theme → paste/merge into `site/app/globals.css`.
6. If the output format ≠ our CSS variable shape, write a thin
   adapter script in `site/scripts/apply-tweakcn-theme.mjs`.

## Path B — site-integration (nice-to-have)

Only pursue if Path A succeeds AND tweakcn's editor can be embedded
without bloating the site bundle. Landing location: `/admin/theme`
(dev-only) or similar.

If tweakcn is heavy or its import graph leaks through to production
bundles, stop; keep it as a standalone tool.

## Risks

- AI theme generation may need a custom OpenAI endpoint / model override.
- tweakcn may output tokens in a shape incompatible with our existing
  shadcn theme. Adapter fixes this, but adds one file of glue.

## Not in scope

- Designing the actual palette. That's operator-driven via the generator.
- Site-wide theme migration. Task 45-14 does that after tokens exist.
