# GAD marketing site (`site/`) — agent guide

## Client debug overlay (deployed / production review)

Set **`NEXT_PUBLIC_CLIENT_DEBUG=1`** on Vercel (or `.env.local`) and **redeploy**. The app wraps the tree in `ClientDebugShell` (`components/debug/ClientDebugShell.tsx`): a fixed **bottom dock** shows `window` errors, **unhandled promise rejections**, **React render errors** (via an error boundary), and mirrored **`console.error` / `console.warn`**. Lines are also appended to **`window.__GAD_DEBUG_LINES`** for inspection in DevTools.

Optional **`NEXT_PUBLIC_CLIENT_DEBUG_VERBOSE=1`** also mirrors **`console.log` / `console.info`** (noisy on busy pages).

When the env var is unset, the shell renders children only — no extra listeners or UI.

## UI blocks and `Identified`

`Identified` wraps **stable, named chunks** of the UI (`as="RunProcessMetricsCards"`, `as="ProjectHero"`, …). In dev, those names register for the dev-id panel so people can say “change `RunProcessMetricsCards`” and mean the same DOM region as the code.

**Section dev panel** (`SectionDevPanel.tsx`): With dev IDs on (`Alt+I`), each `SiteSection` shows a gear. The panel shell uses stable **`data-cid="gad-dev-panel"`** (label **Dev Panel**); the id is shown in the **sticky header** only (`register={false}` — it is **not** duplicated as a list row). List rows are **sorted by registry depth** (ascending): **`sectionBandCid`** on `SiteSection` registers the `<section>` shell at **depth 0** first, then `<Identified>` bands. Hover a row for a **HoverCard** (left, high z-index) with `data-cid`, label, and **app route**. The message icon opens **agent handoff** (`DevIdAgentPromptDialog`): **Update** / **Delete** tabs with one **full-page-style prompt editor** each; **Dictate** (large mic, inserts at caret) and **Copy** share a bottom row that appears **on hover** of the prompt area. Inner chrome (e.g. `*Heading` bands) should use **`register={false}`** so the dev panel favors **outer bands** — row click scrolls to `data-cid` on the section shell or an `Identified` wrapper.

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

If only a heading or card is tagged, there is **no stable id for the parent band** — the user cannot point at it except by naming an inner id. **Prefer `sectionBandCid` on `SiteSection`** (stable id + `data-cid` on `<section>`, registers at depth 0) **or** an outer `Identified` wrapping the whole shell — not only the kicker.

On **`/methodology`**, bands that need a single landmark id should set **`sectionBandCid`** (and optional **`sectionBandLabel`**) on **`SiteSection`** to match the section component name (e.g. `MethodologyCompositeSection`). Inner chunks stay as **`Identified`**. **Do not** wrap those sections from `page.tsx` — `Identified` outside `SiteSection` does not register in any dev-id panel. Open-question **category** rows use **`OpenQuestionsCategory-<slug>`** inside `QuestionsCategorySection`; resolved uses **`OpenQuestionsResolvedSection`** inside `QuestionsResolvedSection`.

## Real routes (no hash “redirects”)

Nav and CTAs must point at **real paths** (`/skills`, `/skills?tab=agents`, `/planning?tab=tasks`, `/downloads`). Do not send people to `/#catalog` or other home-page fragments that are not wired to a section id — those read like redirects and break deep linking.
