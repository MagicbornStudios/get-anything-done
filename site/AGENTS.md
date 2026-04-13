# GAD marketing site (`site/`) — agent guide

## UI blocks and `Identified`

`Identified` wraps **stable, named chunks** of the UI (`as="RunProcessMetricsCards"`, `as="ProjectHero"`, …). In dev, those names register for the dev-id panel so people can say “change `RunProcessMetricsCards`” and mean the same DOM region as the code.

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

If only a heading or card is tagged, there is **no stable id for the parent band** — the user cannot point at it except by naming an inner id. **Prefer an outer `Identified` per major band** (inside `SiteSection` so it registers in the section dev panel): e.g. `MethodologyDataPipelineSection` wrapping its entire shell, not only the kicker.

## Real routes (no hash “redirects”)

Nav and CTAs must point at **real paths** (`/skills`, `/skills?tab=agents`, `/planning?tab=tasks`, `/downloads`). Do not send people to `/#catalog` or other home-page fragments that are not wired to a section id — those read like redirects and break deep linking.
