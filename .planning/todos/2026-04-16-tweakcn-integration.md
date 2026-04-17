# TweakCN-OpenAI fork — local theme generator, running

**Date captured**: 2026-04-16
**Executed**: 2026-04-17
**Decision**: gad-231 (adopt tweakcn), gad-230 (palette direction)
**Upstream**: https://github.com/jnsahaj/tweakcn
**Our fork**: https://github.com/B2Gdevs/tweakcn (renamed `tweakcn-openai`, commit `23439d4`)
**Local checkout**: `C:/Users/benja/Documents/tweakcn/` (sibling to custom_portfolio)

## Status: shipped — the fork builds and runs locally

The hosted-first path was rejected in favor of the customize path
(operator signaled from the start: "needs tweaking to work with
openai"). The fork is gutted down to the editor-only path with OpenAI
swapped in. No DB, no auth, no billing, no per-user persistence — just
the editor.

## What shipped in the fork

**Provider swap** — `@ai-sdk/google` + `@google/generative-ai` out;
`@ai-sdk/openai` in. Models: `base=gpt-4o-mini`,
`theme-generation=gpt-4o`, `prompt-enhancement=gpt-4o-mini`. Env:
`OPENAI_API_KEY`.

**Gut** — deleted `app/(auth)/`, `app/(legal)/`, `app/dashboard/`,
`app/settings/`, `app/success/`, `app/pricing/`, `app/community/`,
`app/oauth/`, `app/figma/`, `app/themes/`, `app/r/`, all `app/api/auth`
/ `api/oauth` / `api/subscription` / `api/webhook` / `api/v1` routes,
`db/`, `drizzle/`, `middleware.ts`, `routes.ts`,
`components/theme-view.tsx`, the DB-only action files
(account/ai-usage/checkout/community-themes/customer), `Dockerfile`,
`docker-compose.yml`, `scripts/create-oauth-app.ts`, `lib/polar.ts`,
`lib/checkout.ts`.

**Stubs** (always-local-user, always-unlimited, no persistence) —
`lib/auth.ts`, `lib/auth-client.ts`, `lib/subscription.ts`,
`lib/shared.ts`, `hooks/use-subscription.ts`, `hooks/themes/index.ts`
(community-hooks → noops), `components/auth-dialog-wrapper.tsx` (null),
`actions/themes.ts` (in-memory CRUD).

**`types/theme.ts`** — Theme type declared directly (was
`InferSelectModel<typeof theme>` from drizzle).

**`next.config.ts`** — `eslint: { ignoreDuringBuilds: true }` (upstream
ESLint config depends on a Next plugin absent after the strip).

**`package.json`** — renamed `tweakcn-openai`. Removed 12 deps
(polar-sh/*, better-auth, bcryptjs, @neondatabase/serverless, drizzle,
@upstash/ratelimit, @vercel/kv, husky, @types/pg, …).

## How to run

```sh
cd C:/Users/benja/Documents/tweakcn
pnpm install
# Put your OpenAI key in .env.local:
#   OPENAI_API_KEY="sk-..."
PORT=3010 pnpm dev    # or pnpm dev (defaults to 3000)
# Open http://localhost:3010/editor/theme
```

Build passes: `pnpm build` (Turbopack). Dev probe verified — editor
renders at `/editor/theme` and landing at `/`.

## Consuming a theme in the portfolio site

1. Generate a theme in the fork's editor (AI-assist via OpenAI, or the
   visual controls).
2. Click the "Code" / export panel in the editor; copy the CSS variable
   block.
3. Paste into `vendor/get-anything-done/site/app/globals.css` — replace
   the current `:root` / `.dark` blocks.
4. Rebuild: `cd vendor/get-anything-done/site && pnpm build`.

If the export format doesn't drop cleanly into our globals.css (variable
name drift, scaffolding wrapper), write a tiny adapter:
`site/scripts/apply-tweakcn-theme.mjs <exported.css>` that normalises +
writes between `/* tweakcn:start */` and `/* tweakcn:end */` markers.

## Risks / watch-for

- OpenAI rate limits: upstream's Upstash ratelimit was stripped; heavy
  use could hit OpenAI's own quota. Not our problem locally.
- Theme generation quality on OpenAI vs Gemini: upstream tuned prompts
  for Gemini. If outputs look off, `lib/ai/prompts.ts` is the one place
  to tweak the system prompts.
- Turbopack production builds are flagged experimental by Next; fine
  for local dev, wouldn't deploy this fork.

## Not in scope (parked)

- Embedding the editor inside our portfolio site. Keeping it separate
  per operator direction ("we just want it used inside of projects not
  fully be one").
- Cloud save / community-themes / billing. Stripped by design.
- SQLite local persistence. Zustand localStorage already survives
  refresh; cloud save was the only thing missing.
