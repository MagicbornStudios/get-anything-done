# Visual Context System — layered architecture

The DevId / Visual Context code under `components/devid/` is organized as a
vertical stack of layers so it can be lifted into separate npm packages later
without rewrites, and so non-React consumers (vanilla HTML, Kaplay, Phaser)
can opt into only the layers they need.

## Layers (bottom up)

| Layer | Folder | Depends on | Runtime surface |
| --- | --- | --- | --- |
| `vc-core` | `vc-core/` | — | Pure TS types + helpers. Zero runtime deps. |
| `vc-dom` | `vc-dom/` | `vc-core` | `document` / `CSS.escape` only. Works in any HTML. |
| `vc-chord` | `vc-chord/` | React (store hooks) | Global modifier-key chord (`Alt` / `Ctrl` / `Shift`). |
| `vc-selection` | `vc-selection/` | React (store hooks) | External store + per-cid selector hooks. |
| `vc-react` | `vc-react/` (barrel) | `vc-core`, `vc-dom`, React | `<Identified>`, `<IdentifiedPrimitive>`, `<DevIdProvider>`, shortcut registry. |
| `vc-shadcn` (today: site-level) | rest of `components/devid/` | `vc-react` + shadcn | Styled DevPanel / BandDevPanel / modals. |

### Import rules

- `vc-core` **MUST NOT** import anything else.
- `vc-dom` may import `vc-core`; it may NOT import React.
- `vc-chord` / `vc-selection` may import React (they expose hooks).
- `vc-react` composes the above. Styled UI consumes `vc-react`.
- Legacy files (`SectionRegistry.tsx`, `devid-dom-scan.ts`) are **shims** —
  they re-export from `vc-core` / `vc-dom` so existing call sites compile
  unchanged. New code should import from the barrels.

### Why separate `vc-chord` from `vc-selection`?

Both are external stores, but they track different things at different
frequencies. Keeping them isolated means a component that only cares about
**which** cid is selected never re-renders on a `Ctrl` keydown, and vice
versa. See `vc-chord/README` + `vc-selection/store.ts` docstrings.

## Using the system in non-React projects

### Vanilla HTML / any framework that renders a DOM

Emit the same `data-cid*` attributes the React adapter emits:

```html
<section
  data-cid="hero-section"
  data-cid-label="Hero"
  data-cid-component-tag="SiteSection"
  data-cid-search='cid="hero-section"'
>
  ...
</section>
```

Then call `collectScopedEntries` + `sortRegistryEntries` on a scope. See
`public/demos/vc-vanilla/index.html` for a fully self-contained demo (no
build step, inline JS port of `vc-dom/scan.ts`).

### Kaplay / Phaser (canvas-only engines)

The canvas itself is a single DOM node — individual sprites / UI widgets
aren't in the DOM, so `vc-dom`'s CSS-selector-based scan can't see them.
Two integration strategies:

1. **DOM overlay (recommended for HUD-heavy games):** render your HUD
   (health bar, spell icons, inventory) as a DOM layer absolutely
   positioned over the canvas. Each HUD widget gets a `data-cid*` set and
   `vc-dom` scans them the same way. This is the closest to "any HTML
   project" — the game loop stays in the canvas, but UI is DOM.
2. **Engine-side registry (for in-game entities):** the engine keeps its
   own registry (Kaplay: `get("identified")` tag; Phaser: scene children
   with a `vcId` property). Write a tiny adapter that flushes engine-side
   entries into a `VcRegistryEntry[]` on demand. Point the styled UI
   layer at that in-memory source instead of the DOM scan. The React
   adapter (`vc-react`) doesn't need to change — you just swap
   `collectScopedEntries(scope)` for `collectFromEngine(game)`.

Follow-up work for the Kaplay/Phaser adapters (`vc-kaplay` / `vc-phaser`)
is captured as its own roadmap phase — the core extraction (this bundle)
unblocks that work without requiring it.
