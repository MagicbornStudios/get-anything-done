# Quickstart rewrite + site-wide prose taxonomy — 2026-04-20

Captured from discuss-session on `/quickstart` content, desktop client status,
installer strategy, and prose patterns across the GAD marketing site.

## Decisions locked

| # | Decision |
|---|---|
| 1 | `/quickstart` becomes Desktop-first. Primary CTA installs GAD Desktop (Tauri MSI). Advanced section retains CLI-only path. |
| 2 | Tauri MSI (produced by `apps/desktop` via `tauri build --target x86_64-pc-windows-msvc`) is the **sole consumer installer** for all GAD tooling. Desktop MSI embeds `gad.exe` as sidecar per task 53-02. No separate CLI MSI. Bun-compiled `gad-vX.Y.Z-windows-x64.exe` remains as the portable/advanced distribution. |
| 3 | `/quickstart` implementation = **TSX shell + `.mdx` prose chunks** (Option B from the discuss). Each major block is an explicit `SiteSection` in TSX for stable VCS `cid`s; prose bodies live in `_content/*.mdx`. VCS works inside MDX with zero special integration — `SiteSection` / `Identified` are JSX in MDX body. |
| 4 | Framework-dev content (current `docs/quick-start.md` sections 7-8: `gad site serve --consumer`, monorepo `pnpm-workspace.yaml` wiring) **moves off `/quickstart`** to `AGENTS.md` / dev-facing docs. Consumer quickstart does not talk about the monorepo. |
| 5 | `/downloads` route already exists (`vendor/get-anything-done/site/app/downloads/page.tsx`) and is the correct CTA target. Prior claim that it didn't exist was wrong — grep tooling was filtering `vendor/`. |
| 6 | Prose-on-site uses a **4-class taxonomy** (below). Only Class 1 migrates to MDX. Classes 2-4 stay on their current patterns. |

## Site-wide prose taxonomy

| Class | Content shape | Tool | Examples |
|---|---|---|---|
| 1. Long-form authored docs | Walkthrough + images + code blocks + occasional interactive components | **MDX** | `/quickstart`, `/eval-guide`, future `/docs/*`, future blog |
| 2. Marketing band copy | 1-3 sentences, design-coupled, layout-driven | Hardcoded TSX with `<SiteProse>` + `<SiteSectionHeading>` | All `components/landing/**/Landing*Band.tsx`, `/downloads` section headings |
| 3. Catalog / registry entries | Structured records with filter / search / sort | Source files (SKILL.md, XML, JSON) → `scripts/build-site-data.mjs` prebuild → JSON → React list/detail | `/skills`, `/agents`, `/commands`, `/decisions`, `/lineage`, `/findings`, `/project-market` |
| 4. Micro-copy / quotes | Short strings + metadata, consumed programmatically | TS literal tables | `lib/epigraphs.ts` via `<SectionEpigraph>` |

### Why not all-MDX

1. Class 2 regresses — marketing bands are design-coupled; every MDX line would need `<SiteProse>`/`<Identified>` wrappers, negating markdown ergonomics.
2. Class 3 regresses worse — catalogs need filter/facet/sort, which needs data-driven rendering, not per-entry MDX files.
3. One-pattern-per-class keeps the site comprehensible.

### Future-page heuristic

| Page is… | Use |
|---|---|
| ≥3 paragraphs of prose + images + code blocks + minimal layout chrome | MDX |
| Short copy tightly woven into designed layout | TSX |
| List/detail view of many structured records | data + prebuild + React templates |
| Sentence or two with metadata, reused programmatically | TS literal table (`lib/*.ts`) |

## `/quickstart` rewrite — file map (for future executor, not a commitment)

```
vendor/get-anything-done/site/
  app/quickstart/
    page.tsx                         # rewrite — MarketingShell + 5 SiteSections
    _content/
      hero.mdx                       # new — "Install GAD Desktop"
      desktop-tour.mdx               # new — narration for main window, first-run, project creation
      create-project.mdx             # new — walk through "new project" UX
      first-generation.mdx           # new — narration for terminal-as-chat first run
      advanced-cli.mdx               # new — CLI-only path (current quick-start.md sections 1-6 rewritten for consumer tone)
  components/quickstart/
    QuickstartScreenshot.tsx         # new — VCS-wrapped placeholder (aspect-ratio box + caption, swap to <Image> when assets exist)
    QuickstartAdvancedFold.tsx       # new — <details>-based collapsible advanced section
  mdx-components.tsx                 # new — maps h1/h2/p/code/pre to site design primitives
  next.config.ts                     # edit — withMDX() + pageExtensions: ['tsx','mdx']
  package.json                       # edit — add @next/mdx, @mdx-js/loader, @mdx-js/react
docs/
  quick-start.md                     # delete or relocate; consumer content migrates to MDX chunks; framework-dev content (sections 7-8) moves to AGENTS.md
```

Incremental path allowed: ship rewrite as pure TSX first (no MDX deps), factor prose to MDX in a follow-up. Pure TSX alone already gets VCS granularity + real structure.

## Desktop client — status snapshot (for context)

Phase 53, milestone `gad-v1.1`. Governing decisions: gad-218 (desktop = local-first PM tool), gad-236 (Tauri shell + terminal-as-chat + CLI bridge).

| Task | Status |
|---|---|
| 53-01 | done — Tauri 2.x scaffold, Windows-x64, MSI bundle target |
| 53-11 | done — `packages/visual-context` extracted; desktop shell VCS-wrapped |
| 53-02..08, 53-09 (CI MSI), 53-10 (auto-update) | planned |

Consequence: no real Desktop screenshots exist today. Quickstart rewrite either (a) uses labeled placeholder boxes with "coming soon" captions until phase 53 ships, or (b) blocks on 53-03/05/06.

## Adjacent free wins if MDX lands

Same deps + same `mdx-components.tsx` also cover:
- `/eval-guide` (if it exists and uses the same `marked.parse` + `dangerouslySetInnerHTML` hack as `/quickstart` today)
- Future GAD-site blog

## Open items (not blocking this note — decide at execute time)

1. Ship pure TSX first vs. MDX in one pass.
2. Advanced section: inline `<details>` fold vs. anchor jump to sibling section.
3. Screenshot strategy while 53-03/05/06 are planned: labeled placeholder boxes vs. omit Desktop-tour section entirely until real shots exist.
4. `docs/quick-start.md` — delete outright or relocate to `docs/dev/` as developer CLI reference.
5. Standalone CLI MSI (separate from Desktop MSI) — **rejected this session**. Re-open only if consumer install telemetry later shows meaningful CLI-only demand.

## References

- `vendor/get-anything-done/site/app/quickstart/page.tsx` — current markdown-dump implementation.
- `vendor/get-anything-done/docs/quick-start.md` — current content source.
- `vendor/get-anything-done/site/app/downloads/page.tsx` — already-live downloads route.
- `vendor/get-anything-done/site/components/site/SiteProse.tsx` — Class 2 prose primitive.
- `vendor/get-anything-done/site/lib/epigraphs.ts` — Class 4 exemplar.
- `apps/desktop/src-tauri/tauri.conf.json` — MSI bundle target + gad sidecar binary.
- `apps/desktop/README.md` — phase 53 context.
- Decisions: gad-188 (installer pipeline), gad-218 (desktop = local-first), gad-236 (Tauri shell), gad-118 (`/quickstart` + `/eval-guide` from `docs/*.md`).
