# Findings belong in the docs site, not the marketing site

Status: open · captured 2026-04-18 by cursor-default-0026 from project user
direction ("we don't need a `findings/` on the marketing site. findings were
just for docs.").

## Why this note exists

Phase 42.2-05 was cancelled today because findings should not be a
marketing surface at all. The right home for them is the monorepo docs
site under `apps/portfolio/content/docs/get-anything-done/findings/`.
This note carries the work forward without inventing a speculative phase.

## What lives where today (2026-04-18 audit)

| Surface | Path | State |
|---|---|---|
| Source `.md` files | `vendor/get-anything-done/evals/FINDINGS-*.md` | canonical, parsed by `build-site-data.mjs` → `parseFindings()` |
| Marketing `/findings` route | `vendor/get-anything-done/site/app/findings/` | **does not exist** (purged in phase 46) |
| Per-project section | `vendor/get-anything-done/site/app/projects/[...id]/ProjectFindingsSection.tsx` | renders findings tagged with the project |
| Stale `/findings` URLs | `site/public/llms.txt`, `site/public/api/docs.json` | dead links inherited from the pre-46 nav; need a sweep |
| Docs site findings | `apps/portfolio/content/docs/get-anything-done/findings/` | **does not exist** — work to do |

## Proposed next move

Two small tasks, both safe to take in any order:

1. **Mirror findings into the docs site** — `pnpm`-time script (or
   one-shot mdx generator) that reads `vendor/get-anything-done/evals/FINDINGS-*.md`,
   wraps them in MDX frontmatter (title, date, projects, version),
   and writes them into `apps/portfolio/content/docs/get-anything-done/findings/`.
   Decide: copy at build time, or commit a one-time mdx tree and keep
   in sync manually. First cut: one-time copy with a follow-up CI
   diff guard if the source files change.
2. **Strip stale `/findings` URLs from generated marketing artifacts** —
   in `vendor/get-anything-done/site/scripts/build-site-data.mjs`, remove
   the `Findings` line from the llms.txt block (around line 1790) and
   re-emit `public/api/docs.json` so it stops advertising a 404.

The per-project `ProjectFindingsSection` is a separate question — it
shows findings on a per-project page, which IS a marketing context.
Project user did not call this one out today, so leave it as-is unless
explicitly asked. If/when removed, the per-project page should link
into the docs-site location instead.

## Adjacent decisions

- gad-169 — "findings as whitepapers" framing was always docs-leaning
- phase 46 — purged speculative routes (glossary, hypotheses, etc.);
  `/findings` was caught by the same sweep without a replacement plan
- 45-15 — vocabulary audit treats findings as articles/whitepapers
