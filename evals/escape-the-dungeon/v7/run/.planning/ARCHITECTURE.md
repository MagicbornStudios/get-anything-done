# Architecture: Escape the Dungeon

## Stack
- **KAPLAY** (v3001.x) - Web game framework for canvas rendering, scenes, input
- **TypeScript** - Type safety across all game code
- **Vite** - Build tooling, dev server, production bundling

## File Structure

```
game/
  src/
    main.ts              # Entry point: KAPLAY init, scene loading, start
    types.ts             # All game type definitions
    content/
      dungeon.ts         # 3-floor dungeon with room graphs and map layouts
      entities.ts        # Enemies, bosses, NPCs with combat stats
      runes.ts           # 26 runes (A-Z) with types, colors, power
      spells.ts          # Authored spells and level curve
    scenes/
      mainMenu.ts        # Title screen with New Game / Continue
      intro.ts           # Narrative intro beat
      game.ts            # Core gameplay: floor map, room info, actions, HUD
      combat.ts          # Turn-based combat: Fight/Spells/Bag/Run
      dialogue.ts        # NPC dialogue with portrait and line advancement
      runeForge.ts       # Spell crafting from rune combinations
      gameOver.ts        # Win/lose screen with run summary
    systems/
      gameState.ts       # Global state, player init, movement, combat math,
                         # XP, rest, search, crafting, save/load
  dist/                  # Production build output
  index.html             # HTML shell
  vite.config.ts         # Vite config with relative base path
  tsconfig.json          # TypeScript config
```

## Architecture Decisions

1. **Scene-based architecture**: Each major interaction is a KAPLAY scene. Scenes are functions that register with `k.scene()` and are navigated via `k.go()`.

2. **Global singleton state**: `gameState.ts` holds a module-level `_gameState` accessed via getters/setters. All systems (combat, movement, crafting) mutate this state.

3. **Content as TypeScript modules**: Dungeon layouts, entities, runes, and spells are TypeScript constants. Content-driven but statically imported (no runtime JSON loading).

4. **Button-choice navigation**: No tile-based movement. Floor map renders rooms as a visual board. Players click adjacent rooms or exit buttons to move.

5. **Room-feature-driven actions**: Each room type (rest, treasure, combat, dialogue, rune_forge) shows appropriate actions in the right panel.

## Key Systems

### Navigation
- Room graph with exits (direction + targetRoomId)
- Map layout with x/y grid positions for visual rendering
- Discovery/fog: undiscovered rooms appear dark, boss room always visible
- Dungeon tick advances on each room entry

### Combat
- Turn-based: player acts, then enemy acts
- Four actions: Fight (physical), Spells (mana-based), Bag (items), Run (agility check)
- Damage uses might/power/defense with variance
- Spell damage scales with power, insight, and rune affinity
- XP and crystal rewards on win; level-ups increase HP/mana

### Spell System
- 26 runes (A-Z) with element types and base power
- Rune forge: select 1-4 runes, spend 5 crystals to craft
- Custom spell power = sum of rune base powers + affinity bonuses
- Rune affinity increases on spell cast (+2 per rune, cap 100)
- 4 prepared spell slots for combat use

### Persistence
- Save/load via localStorage (JSON serialization of full game state)
- Save button in game HUD; Continue button on main menu
