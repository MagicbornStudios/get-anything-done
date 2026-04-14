# Architecture: Escape the Dungeon

## Overview

A roguelike dungeon crawler built with Vite + TypeScript + KAPLAY. The player navigates rooms via button choices, fights enemies in turn-based combat, talks to NPCs, collects loot, and progresses through 3 dungeon floors. All game data is loaded from JSON content packs.

## Key Modules

| Module | Purpose |
|--------|---------|
| `src/main.ts` | Entry point. Initializes KAPLAY, registers all scenes, starts at title. |
| `src/types.ts` | All TypeScript interfaces: content pack types, runtime game state, combat state. |
| `src/systems/state.ts` | Game state singleton. New game, save/load (localStorage), inventory, XP/leveling. |
| `src/systems/content.ts` | Content manager. Loads all JSON packs at import time, provides typed getters. |
| `src/systems/ui.ts` | Reusable UI helpers: `makeButton()`, `makeBar()`, `addCenteredText()`. |
| `src/scenes/title.ts` | Title screen with New Game / Continue buttons. |
| `src/scenes/room.ts` | Main gameplay: HUD, room description, type-specific interactions, exit navigation. |
| `src/scenes/combat.ts` | Turn-based combat: Fight/Spells/Bag/Run. Module-scoped enemy state. |
| `src/scenes/dialogue.ts` | NPC dialogue with choice effects (give item, buy item). |
| `src/scenes/stats.ts` | Character stats overlay. |
| `src/scenes/bag.ts` | Inventory overlay. |
| `src/scenes/map.ts` | Floor map showing discovered/current rooms. |
| `src/scenes/gameover.ts` | Death screen with continue option. |
| `src/data/*.json` | Content packs: entities, floors, spells, items, dialogue. |

## Data Flow

1. JSON content packs are imported at build time via Vite's `resolveJsonModule`.
2. `ContentManager` provides typed access to all game data.
3. `state.ts` holds the mutable game state singleton (player stats, position, inventory).
4. Scenes read from both content (static data) and state (runtime data) to render UI.
5. User actions (button clicks) mutate state and trigger scene transitions via `k.go()`.
6. State auto-saves to localStorage on room entry and after key actions.

## Key Decisions

1. **KAPLAY `global: false`** -- All KAPLAY functions accessed via returned context object `k`, passed to every scene. Avoids global namespace pollution.
2. **Scene-per-view** -- Each game screen is a KAPLAY scene. Scene transitions destroy all objects and rebuild. Simple but effective for a choice-driven game.
3. **Module-scoped combat state** -- Enemy HP and combat log persist across scene re-renders within a single combat encounter (spell selection, bag use, back to combat).
4. **Content-driven architecture** -- Zero hardcoded game data. All entities, rooms, spells, items, and dialogue defined in JSON files.
5. **Simplified navigation** -- Button-based room exits instead of tile/grid movement. Matches the "choice-driven" design requirement.
