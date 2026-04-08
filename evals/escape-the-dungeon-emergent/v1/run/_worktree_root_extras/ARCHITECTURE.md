# Architecture: Escape the Dungeon

## Stack
Vite + TypeScript + KAPLAY (v3001.0.19). Single page app, no backend.

## Module Structure
- `main.ts` — Boot: init KAPLAY, load content packs, register scenes, go to title
- `types.ts` — All game type definitions (entities, rooms, floors, spells, items, dialogue)
- `content.ts` — ContentManager singleton: fetches JSON packs from public/data/, typed getters
- `state.ts` — Game state management: create, save (localStorage), load, stat composition
- `ui.ts` — Reusable UI helpers: makeButton, makeText, makePanel, makeHpBar, color palette
- `scenes/` — One file per scene group: title, room, combat, dialogue, menus
- `scenes/index.ts` — Scene registry: maps scene names to callbacks, handles go() data passing

## Data Flow
1. Boot: ContentManager.load() fetches 5 JSON packs in parallel
2. Title -> New Game -> createNewGame() composes stats from entityType + archetype -> go("room")
3. Room scene reads state + content, renders HUD + room info + exits as buttons
4. Exit click -> update state (roomId, tick, discovery) -> saveGame() -> go("room")
5. Combat/dialogue: scene receives data via go() args, manages sub-state internally

## Key Decisions
- KAPLAY v3 stable (not v4 alpha) for API stability
- All game content in JSON packs (content-driven architecture)
- Scene pattern: destroyAll(tag) before re-rendering (prevents ghost UI)
- Stat composition: base + archetype modifiers (additive)
- localStorage for persistence, auto-save on room entry
- Button-based navigation, not tile movement
