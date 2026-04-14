# GAD marketing site (`site/`) — agent guide

## Client debug overlay (deployed / production review)

Set **`NEXT_PUBLIC_CLIENT_DEBUG=1`** on Vercel (or `.env.local`) and **redeploy**. The app wraps the tree in `ClientDebugShell` (`components/debug/ClientDebugShell.tsx`): a fixed **bottom dock** shows `window` errors, **unhandled promise rejections**, and **React render errors** (via an error boundary). Lines are appended to **`window.__GAD_DEBUG_LINES`** and subscribed with **`useSyncExternalStore`** (`client-debug-log.ts`) so logging never calls **`setState` during render** (that pattern causes **minified React error #185** — maximum update depth). With the dock visible, **`Alt+Shift+D`** (when not typing in an input) toggles the dock off and on; preference is stored in **`localStorage`** key `gadClientDebugDockHidden`. The header **Off** button does the same as hiding completely; a small **Debug off** chip appears when hidden so you can reopen without the shortcut.

Optional **`NEXT_PUBLIC_CLIENT_DEBUG_CONSOLE=1`** mirrors **`console.error` / `console.warn`** into the dock (off by default so production stays safe). With that on, **`NEXT_PUBLIC_CLIENT_DEBUG_VERBOSE=1`** also mirrors **`console.log` / `console.info`**.

When `NEXT_PUBLIC_CLIENT_DEBUG` is unset, the shell renders children only — no extra listeners or UI.

Header **Copy** (icon, top-right of the dock) copies the full log as plain text.

## UI blocks and `Identified`

`Identified` wraps **stable, named chunks** of the UI (`as="RunProcessMetricsCards"`, `as="ProjectHero"`, …). In dev, those names register for the dev-id panel so people can say “change `RunProcessMetricsCards`” and mean the same DOM region as the code. Default rule: the copied/searchable token should exist in source. `Identified` now uses the literal `as` string as its default `data-cid`; if you need a custom token, pass explicit `cid` (preferred) or legacy `stableCid`.

**Visual Context Panel** (`DevPanel.tsx` via `BandDevPanel`): With dev IDs on (`Alt+I`), each `SiteSection` / `PageIdentified` band shows the same compact panel on **hover/focus** as an overlay. The panel has the accent header, stable **`visual-context-panel`** id (copy from header), and list rows that copy/search **source tokens** (`cid="..."`, `stableBandCid="..."`, `as="..."`) rather than only runtime `data-cid` values. **Message** opens **`DevIdAgentPromptDialog`** (Update / Delete prompts, dictation, copy). Prefer explicit `cid` on `SiteSection`; `stableBandCid` is legacy alias. There is no `useId` section-band fallback anymore: if no explicit `cid`/`stableBandCid`/`id` is present, the band does not get a stable dev id.

**Rules of thumb:**

1. **`as` is a block label**, not a database key. Use one stable string per *replaceable* region. Repeating list rows may all share one label (e.g. `RunDimensionScoreRow`) so you jump to the **component file**, not hundreds of unique ids.
2. **Do not template `as` with run/project/version** — that defeats “what chunk is this?”
3. **Imports next to dynamic App Router segments** — folders are literally named `[project]`, `[id]`, etc. They are **not** runtime template imports. Still, **avoid** `@/app/.../[segment]/...` in source: use **`./SiblingComponent`** for anything co-located in the same route folder. Shared code lives under `@/lib/...` or `@/components/run-detail/...` so paths stay readable in reviews and docs.

## Shared run-detail surface

- `@/lib/run-detail-shared` — score ordering, `formatNum`, `RunScores` type
- `@/lib/run-process-metrics-runtime-label` — runtime chip label helper
- `@/components/run-detail/RunScoreBar` — dimension score bar
- `@/components/run-detail/process-metric-cards/*` — process metrics card tiles

When you add a new major band on `/runs/...`, add an `Identified` at the **section** or **grid** level you would swap in a visual CMS—not every inner `div`.

### Dev ids as landmarks (not only edit targets)

Humans cite `data-cid` / dev-panel labels to mean **“this whole area”** — often the **parent section**, not the innermost tagged node. When someone names an id, **confirm intent** before editing:

1. **Scoped tweak** — change only that wrapper or its children.
2. **Remove or rewrite the whole section** — delete or replace the **outer shell** (the `SiteSection`, page band, or `Identified as="…Section"` that contains that subtree).

If only a heading or card is tagged, there is **no stable id for the parent band** — the user cannot point at it except by naming an inner id. Prefer an explicit `cid` on the parent `SiteSection` so the band itself is greppable in code. Use an outer `Identified` wrapping the whole shell for additional named landmarks — not only the kicker.

**Page-level bands** (outside any `SiteSection` registry): use **`PageIdentified`** (`components/devid/PageIdentified.tsx`) from route `page.tsx`. It now uses the same hover dev-panel surface as nav/footer, so page bands get the same Update/Delete handoff flow and descendant list as other band-level landmarks. Prefer explicit `cid`; otherwise the literal `as` string becomes the band `data-cid`. Open-question **category** rows use **`OpenQuestionsCategory-<slug>`** inside `QuestionsCategorySection`; resolved uses **`OpenQuestionsResolvedSection`** inside `QuestionsResolvedSection`.

## Real routes (no hash “redirects”)

Nav and CTAs must point at **real paths** (`/skills`, `/skills?tab=agents`, `/planning?tab=tasks`, `/downloads`). Do not send people to `/#catalog` or other home-page fragments that are not wired to a section id — those read like redirects and break deep linking.
