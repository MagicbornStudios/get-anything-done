# tweakcn theme generator — hosted-first, with adapter for our globals.css

**Date captured**: 2026-04-16
**Decision**: gad-231 (adopt tweakcn), gad-230 (palette: black/gold/maroon/red, gilded)
**Source**: https://github.com/jnsahaj/tweakcn, hosted at https://tweakcn.com

## Correction after inspection (2026-04-16)

Self-hosting tweakcn was investigated and rejected as the default path.
The repo is a full SaaS stack — `.env.example` requires:

- Postgres (Neon serverless adapter)
- Better-auth with GitHub + Google OAuth credentials
- Google Gemini API key (their AI provider — NOT OpenAI)
- Groq API key
- Google Fonts API key

Not a 5-minute local run. Overkill for "I just need to generate a theme."

## Path A — hosted (committed)

1. Operator visits https://tweakcn.com.
2. Uses their AI theme generator (Gemini-backed) or manual editor to
   produce a theme matching gad-230 — black-dominant, gold/maroon/red
   accents, gilded-shiny, sleek, non-typical.
3. Exports the theme as shadcn-compatible CSS variables (they support
   this via an "Export" / "Code" button in the editor).
4. Operator pastes the exported CSS into `site/app/globals.css`
   (replacing the current `:root` / `.dark` variable blocks).
5. Build + eyeball `/`, `/projects/[...id]`, `/project-market` to
   confirm the palette lands without breaking anything.

## Adapter script (write when first theme lands)

If the exported CSS doesn't drop cleanly into `globals.css` (e.g. uses
different variable names, or includes extra scaffolding), write a
small adapter:

`site/scripts/apply-tweakcn-theme.mjs <path-to-exported.css>`

Normalizes variable names, strips tweakcn-specific scaffolding, writes
into `site/app/globals.css` between `/* tweakcn:start */` and
`/* tweakcn:end */` markers so the apply is idempotent.

## Path B — self-host (deferred)

Only if we want the editor embedded inline on our own site. Would
require:

- Provision a dev Neon DB + drizzle migrations.
- Create OAuth apps.
- Google Gemini API key (tweakcn's AI provider). The operator's
  "needs tweaking to work with OpenAI" hint suggests a fork/patch to
  swap Gemini for OpenAI — doable but nontrivial (Vercel AI SDK call
  sites + different streaming / system prompt shape).
- Package it either as a mounted Next.js route or as an iframe-embed
  from our own hosted instance.

Park this until Path A produces visible value.

## Risks

- tweakcn.com's export format may change. Adapter script absorbs drift.
- If we outgrow the hosted editor's feature set, self-host becomes the
  right call. Until then, simplest-thing-that-works wins.

## Not in scope

- Designing the actual palette. Operator-driven via the generator.
- Site-wide theme migration. Task 45-14 does that AFTER the first
  exported theme lands in `globals.css`.
