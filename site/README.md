# get-anything-done — landing site

A static Next.js 15 + Tailwind v4 + shadcn landing page for the GAD project. Self-contained,
no auth, no database, no dynamic data — eval results are baked into `lib/eval-data.ts` from
the canonical `evals/<project>/<version>/TRACE.json` files at build time.

## Local development

```sh
cd site
pnpm install   # or npm install / yarn install
pnpm dev       # http://localhost:3000
pnpm build     # production build
```

## Deploying to Vercel

This site is intended to deploy from the `get-anything-done` repository as its own Vercel
project, separate from the parent monorepo.

1. Create a new Vercel project pointing at `https://github.com/MagicbornStudios/get-anything-done`.
2. In **Project Settings → General → Root Directory** set the root to `site`.
3. Framework preset: **Next.js** (auto-detected).
4. Build command, output directory, install command: leave on defaults.
5. Deploy.

That's it. No env vars required.

## Updating the eval results

The cards on the Results section come from `lib/eval-data.ts`. When a new round publishes,
re-run whichever script regenerates that file (currently hand-edited; future: `gad eval sink`)
and commit. The page is fully static — a redeploy is the only thing needed.

## Layout

```
site/
├── app/
│   ├── layout.tsx       # root layout, dark mode by default
│   ├── page.tsx         # composes the landing sections
│   └── globals.css      # Tailwind v4 + theme tokens + utilities
├── components/
│   ├── ui/              # shadcn primitives (Button, Card, Badge, Separator)
│   └── landing/         # Nav, Hero, WhatItIs, Lineage, Framework, Results, RunIt, Footer
├── lib/
│   ├── utils.ts         # cn() helper
│   └── eval-data.ts     # static eval results
├── components.json      # shadcn config
├── next.config.mjs
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```
