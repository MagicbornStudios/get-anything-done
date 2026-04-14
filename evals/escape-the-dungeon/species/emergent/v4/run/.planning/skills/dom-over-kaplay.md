# DOM over KAPLAY for UI-heavy roguelikes

## When to use

- You are building a turn-based, menu-heavy, UI-quality-gated game (not a real-time
  action game with physics or tile movement).
- Previous runs that used KAPLAY hit scene-transition bugs, styled-text crashes
  (`[color]` tags unclosed), or shipped unpolished fonts and bars.
- The UI-quality gate is scored on layout, icons, bars, and theme — all things the
  browser does better than a canvas framework.

## The pattern

Build the whole game as plain DOM + CSS + TypeScript. No canvas framework.

- Views = methods on a `UI` class that set `root.innerHTML` then wire click handlers
  via `data-action` attributes.
- Every view re-renders from state. No incremental DOM updates — state change → full
  re-render of the current view. One-place bug surface.
- `iconify-icon` web component (npm: `iconify-icon`) + `@iconify-json/game-icons`
  gives ~4000 game-themed SVG icons with zero bundler work. Icons are hot-fetched
  from Iconify's CDN at runtime.
- CSS variables for theme (`--blood`, `--arcane`, `--gold`, `--mana`…) + per-room
  `data-theme` attribute for room-type differentiation.
- Combat uses a single re-render per turn; enemy turn is a `setTimeout` that calls
  `state.onUpdate?.()`.

```ts
class UI {
  render() { /* switch on state.view */ }
  private bind() {
    this.root.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
      el.addEventListener("click", () => this.handle(el.dataset.action!, el));
    });
  }
}
```

## Why

- KAPLAY was designed for real-time games. Using it for a menu-driven roguelike
  means fighting its scene/camera/text systems for things the DOM already does.
- Every previous KAPLAY run died on a KAPLAY-specific bug (styled text, scene args,
  button `k.area()` missing). The DOM has none of those failure modes.
- The bare v2 run (highest human score, 0.50) was DOM-based. That is not a
  coincidence — it is the single highest-leverage methodology choice for this eval.
- Tier-1 icons (`@iconify-json/game-icons`) render as web components with no build
  pipeline. One `<iconify-icon icon="game-icons:crossed-swords">` = shipped icon.

## Failure modes

- **Icon name typos.** game-icons names are kebab-case only. `sandsOfTime` is wrong;
  `hourglass` or `sandglass-sand-top` is right. Typos silently render nothing.
- **Inline event handlers don't work through innerHTML.** You can't write
  `onclick="..."` and expect bundled code to find the function. Use `data-action`
  attributes and wire them in a `bind()` pass after each render.
- **State mutation without re-render.** If you mutate state from a setTimeout (e.g.
  enemy turn) you must trigger a render. Put an `onUpdate?: () => void` on the
  state object and call it from async branches.
- **Nested modals leaking.** `closeModal()` must query and remove ALL matching
  elements — don't assume there's only one.

## Related

- Supersedes `kaplay-scene-pattern.md` for UI-heavy games — keep that skill for
  actual real-time games only.
- Depends on `find-sprites.md` (tier 1 — iconify pick).
