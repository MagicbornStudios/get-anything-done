# Skill: KAPLAY Scene Pattern

**Source:** escape-the-dungeon-bare v1, updated with v1 failure analysis
**Category:** Code pattern
**Version:** 2

## Pattern

Scenes use a `render()` function that destroys all tagged objects and re-creates them.
Tag everything with a scene-specific tag (e.g., "ui", "hud", "menu", "combat-ui", "dlg").
Call `k.destroyAll("tag")` before re-rendering.

## When to use

Every time you create or update a KAPLAY scene.

## Example

```typescript
function render(k: KAPLAYCtx) {
  k.destroyAll("menu-ui");
  // ... create new objects with .tag("menu-ui")
}
```

## Failure modes

- **"Styled text error: unclosed tags START"** — This happens when you pass KAPLAY's
  `k.add([k.text("[tag]text[/tag]")])` styled text with unclosed tags. Double-check
  all `[color]...[/color]` and `[bold]...[/bold]` tags are properly closed. If a
  variable value contains `[` characters, escape them or use plain text instead.

- **Ghost UI elements stacking** — If you forget to `destroyAll` before re-rendering,
  old elements persist behind new ones. Always destroy before creating.

- **Scene transition with stale state** — When using `k.go("sceneName")`, KAPLAY
  creates a fresh scene context. Don't assume objects from the previous scene exist.
  Pass state via the scene data argument: `k.go("room", { gameState })`.

## Known fixes

- Use `global: false` mode for typed `k.` context — avoids namespace pollution
- Always pass scene data as a single object: `k.go("scene", { key: value })`, NOT
  `k.go("scene", value1, value2)` — KAPLAY v3 only accepts one data argument
- If buttons don't respond to clicks, ensure they have `k.area()` component attached
