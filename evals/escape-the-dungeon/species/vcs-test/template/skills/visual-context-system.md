# Visual Context System (VCS) — Game Implementation

Build agent-addressable identity landmarks into the game so a human can point
at any UI element and a coding agent can find the exact source code.

## Core invariant

Every user-facing region has a **source-searchable identity literal** — a token
that appears verbatim in a source file and can be found with plain `grep`.
No runtime-generated IDs. No template-literal concatenation.

## What to build (Workflow A — greenfield game)

### 1. Identity system

Create a lightweight identity registry that tracks named UI regions:

```typescript
// src/systems/vcs.ts
const VCS_REGISTRY = new Map<string, { kind: string; label: string }>();

export function vcRegister(cid: string, kind: string, label: string) {
  VCS_REGISTRY.set(cid, { kind, label });
}

export function vcGetAll(): Array<{ cid: string; kind: string; label: string }> {
  return Array.from(VCS_REGISTRY.entries()).map(([cid, v]) => ({
    cid, kind: v.kind, label: v.label
  }));
}
```

### 2. Scene-level landmarks

Every scene registers its major sections with string literal CIDs:

```typescript
// In each scene file:
vcRegister("title-screen", "scene", "Title Screen");
vcRegister("title-new-game-btn", "button", "New Game Button");
vcRegister("combat-enemy-stats", "panel", "Enemy Stats Panel");
vcRegister("combat-action-buttons", "panel", "Action Buttons");
vcRegister("game-hud", "panel", "HUD");
vcRegister("game-navigation", "panel", "Navigation Buttons");
```

### 3. Dev panel (dev-only)

A togglable overlay that shows all registered CIDs. Gate behind a dev check:

```typescript
// Toggle with a keyboard shortcut (e.g., backtick `)
if (import.meta.env.DEV) {
  k.onKeyPress("`", () => toggleDevPanel());
}
```

The dev panel should:
- List all registered CIDs with their kind and label
- Allow click-to-copy of a CID
- Show the current scene name
- Be dismissable

### 4. Naming convention

`<scene>-<section>[-<detail>]`

Examples:
- `title-screen` — the title scene
- `combat-action-buttons` — the action button row in combat
- `combat-spell-select` — spell selection UI
- `game-hud-hp` — HP display in the HUD
- `game-room-exits` — navigation exit buttons
- `dialogue-choices` — NPC dialogue choice buttons

### 5. Agent handoff

When a human copies a CID from the dev panel, the agent should be able to:
1. `grep -rn "title-new-game-btn" src/` — find the exact source location
2. See the component kind and label for context
3. Know which scene file to edit

## Success criteria

- Every scene has at least 3 registered CIDs
- `grep` for any CID returns exactly 1 source file hit
- Dev panel toggles on/off with keyboard shortcut
- CIDs are literal strings (not computed/concatenated)

## Failure modes

- Using KAPLAY's internal IDs instead of stable string literals
- Registering CIDs at runtime from data (defeats grep)
- Forgetting to register CIDs for interactive elements (buttons, menus)
- Dev panel visible in production builds
