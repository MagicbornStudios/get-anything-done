# Architecture — Escape the Dungeon

## Stack
Vite + TypeScript + KAPLAY v3 (web game framework). Single page app.

## Module structure
- `src/main.ts` — Entry point, loads content, inits KAPLAY, registers scenes
- `src/types.ts` — All TypeScript interfaces (GameState, CombatStats, Room, etc.)
- `src/content.ts` — Content pack loader with fallback data, singleton pattern
- `src/state.ts` — Game state management, save/load, XP/leveling, buff system
- `src/ui.ts` — UI drawing utilities (buttons, bars, panels, icons, portraits)
- `src/scenes/` — One file per scene (title, room, combat, dialogue, forge, bag, spellbook, map)

## Data flow
1. Content packs loaded from `public/data/*.json` at startup
2. Game state created from content + archetype selection
3. Scenes receive `{ gameState }` via `k.go()` scene data argument
4. Each scene uses `destroyAll(tag)` + re-create pattern for UI updates
5. Auto-save to localStorage on room entry

## Key decisions
- No KAPLAY styled text (avoids crash with `[color]` tags)
- Single object scene data arg (KAPLAY v3 requirement)
- All clickable elements have `k.area()` component
- Combat always transitions back to room scene
- Content-driven architecture: entities, floors, spells, items all from JSON
