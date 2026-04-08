# Escape the Dungeon - Architecture

## Overview

A roguelike dungeon crawler built with Vite + TypeScript + KAPLAY. The player navigates a dungeon via button-choice navigation (no tile movement), fights enemies in turn-based combat, talks to NPCs, collects loot, and progresses through 3 floors to escape.

## Key Modules

- **`src/main.ts`** - Entry point. Initializes KAPLAY, loads content packs, registers scenes, starts title screen.
- **`src/types.ts`** - All TypeScript interfaces for content packs (entities, rooms, items, spells, dialogue) and game state (player, inventory, progression).
- **`src/systems/content.ts`** - Singleton content manager. Loads all JSON data packs at startup. Provides lookup methods for entities, rooms, items, spells, and dialogue.
- **`src/systems/gamestate.ts`** - Player creation (entity type + archetype stat composition), game state initialization, XP/level-up, localStorage save/load.
- **`src/systems/combat.ts`** - Turn-based combat engine. Enemy creation from content packs, attack damage calculation, spell casting, enemy AI turns, flee mechanic, reward computation.
- **`src/scenes/title.ts`** - Title screen with New Game / Continue buttons.
- **`src/scenes/game.ts`** - Main gameplay scene. Room rendering, HUD (HP/mana/floor/tick/crystals), navigation buttons, room-specific actions (fight, talk, loot, rest), overlay menus (Map, Bag, Stats).
- **`src/scenes/combat.ts`** - Combat UI. Shows enemy/player stats, HP/mana bars, combat log, action buttons (Fight/Spells/Bag/Run), spell selection.
- **`src/scenes/dialogue.ts`** - NPC dialogue with choice buttons and effects (give items, teach spells).
- **`src/scenes/gameover.ts`** / **`victory.ts`** - End screens.

## Data Flow

1. Content packs (JSON in `public/data/`) are loaded once at startup by `ContentManager`.
2. `GameState` is created from content data (entity types + archetypes compose stats).
3. Scenes read from `GameState` and render KAPLAY game objects. User clicks trigger state mutations.
4. State is auto-saved to `localStorage` on room entry and after combat/dialogue.
5. Scene transitions pass the mutable `GameState` object between scenes.

## Key Decisions

- **No global KAPLAY mode** - Used `global: false` to get typed `k.` context, avoiding namespace pollution.
- **Re-render pattern** - Each scene has a `render()` function that destroys all tagged objects and re-creates them. Simple and reliable for a UI-heavy game.
- **Content-driven entities** - Entity stats are composed at runtime from `entityType.baseStats + archetype.statModifiers`. All data in JSON packs.
- **Mutable state object** - Single `GameState` object passed between scenes by reference. Simpler than a state machine for this scope.
- **Button-choice navigation** - Rooms connected by directional exits. Player clicks exit buttons to move. Fog of war reveals adjacent rooms.
