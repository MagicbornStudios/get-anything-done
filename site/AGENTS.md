# GAD marketing site (`site/`) — agent guide

## Client debug overlay (deployed / production review)

Set **`NEXT_PUBLIC_CLIENT_DEBUG=1`** on Vercel (or `.env.local`) and **redeploy**. The app wraps the tree in `ClientDebugShell` (`components/debug/ClientDebugShell.tsx`): a fixed **bottom dock** shows `window` errors, **unhandled promise rejections**, and **React render errors** (via an error boundary). Lines are appended to **`window.__GAD_DEBUG_LINES`** and subscribed with **`useSyncExternalStore`** (`client-debug-log.ts`) so logging never calls **`setState` during render** (that pattern causes **minified React error #185** — maximum update depth). With the dock visible, **`Alt+Shift+D`** (when not typing in an input) toggles the dock off and on; preference is stored in **`localStorage`** key `gadClientDebugDockHidden`. The header **Off** button does the same as hiding completely; a small **Debug off** chip appears when hidden so you can reopen without the shortcut.

Optional **`NEXT_PUBLIC_CLIENT_DEBUG_CONSOLE=1`** mirrors **`console.error` / `console.warn`** into the dock (off by default so production stays safe). With that on, **`NEXT_PUBLIC_CLIENT_DEBUG_VERBOSE=1`** also mirrors **`console.log` / `console.info`**.

When `NEXT_PUBLIC_CLIENT_DEBUG` is unset, the shell renders children only — no extra listeners or UI.

Header **Copy** (icon, top-right of the dock) copies the full log as plain text.

## UI blocks and `Identified`

`Identified` wraps **stable, named chunks** of the UI (`as="RunProcessMetricsCards"`, `as="ProjectHero"`, …). In dev, those names register for the dev-id panel so people can say “change `RunProcessMetricsCards`” and mean the same DOM region as the code.

**Section dev panel** (`SectionDevPanel.tsx`): With dev IDs on (`Alt+I`), each `SiteSection` that opts in shows a gear. The slide-in **Dev Panel** has the accent header, stable **`gad-dev-panel`** id (copy from header), list **sorted by registry depth**, No Radix **HoverCard** / **Tooltip** on list rows (they caused **maximum update depth** inside the transformed slide-in); row label uses a native **`title`** hint and click copies **`data-cid`**, **Eye** for sticky highlight, row label / **Copy** for clipboard only (**no scroll-into-view** — that path was removed as the source of focus/layout churn). **Message** opens **`DevIdAgentPromptDialog`** (Update / Delete prompts, dictation, copy). Prefer **`sectionBandCid`** on `SiteSection` and outer **`Identified`** bands; inner chrome may use **`register={false}`**.

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

On **`/methodology`**, page-level bands (`MethodologyPageIntro`, …) live in **`MethodologyPageBody.tsx`**, which wraps **`SectionRegistryProvider`** + **`SectionDevPanel`** so `Identified` from the page route actually registers (the provider is normally only inside each **`SiteSection`**). Per-section internals still use **`sectionBandCid`** / **`Identified`** inside those section components. Open-question **category** rows use **`OpenQuestionsCategory-<slug>`** inside `QuestionsCategorySection`; resolved uses **`OpenQuestionsResolvedSection`** inside `QuestionsResolvedSection`.

## Real routes (no hash “redirects”)

Nav and CTAs must point at **real paths** (`/skills`, `/skills?tab=agents`, `/planning?tab=tasks`, `/downloads`). Do not send people to `/#catalog` or other home-page fragments that are not wired to a section id — those read like redirects and break deep linking.
