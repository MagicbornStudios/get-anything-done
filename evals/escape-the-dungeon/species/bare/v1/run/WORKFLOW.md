# Escape the Dungeon - Workflow Tracker

## Approach: Build UI-First, Vertical Slice Priority

### Phase 1: Project Setup & Title Screen
- [x] Vite + TypeScript + KAPLAY scaffold
- [x] Title screen with "New Game" button
- [x] Build works, something renders

### Phase 2: Room Navigation
- [x] Room data model + content pack JSON
- [x] Room rendering with navigation buttons
- [x] HUD (HP, Mana, Floor, Player Name)
- [x] At least 3 rooms connected (3 floors, 14 rooms total)

### Phase 3: Combat System
- [x] Enemy encounters in combat rooms
- [x] Turn-based combat: Fight, Spells, Bag, Run
- [x] HP tracking visible on screen
- [x] Combat rewards (XP, crystals)

### Phase 4: Dialogue & NPCs
- [x] Dialogue room with NPC interaction
- [x] Dialogue choices displayed
- [x] Entity model with 5 types from JSON (human, goblin, skeleton, slime, dragon)

### Phase 5: Spells & Abilities
- [x] Pre-made spells from JSON (5 spells)
- [x] Spell casting in combat (costs mana)
- [x] At least one usable ability (fireball, ice shard, heal, thunder, barrier)

### Phase 6: Menus & Save/Load
- [x] Stats/Bag/Map menu overlay
- [x] localStorage save/load
- [x] Auto-save on room entry and after combat/dialogue

### Phase 7: Polish & Production Build
- [x] Content packs finalized (entities, floors, items, spells, dialogue)
- [x] Production build (dist/)
- [x] ARCHITECTURE.md

## Current Phase: 7 (COMPLETE)
## Status: Done - All phases complete

## Decisions Log
- D1: KAPLAY + Vite + TypeScript as specified
- D2: Button-choice navigation, no tile movement
- D3: All game data in JSON content packs
- D4: Used KAPLAY global: false for typed context
- D5: Re-render pattern (destroy all tagged objects, re-create) for simple UI updates
- D6: Entity stats composed from entityType + archetype modifiers
- D7: Single mutable GameState passed between scenes
- D8: 3 floors with 14 rooms (combat, dialogue, treasure, rest, boss)
- D9: 5 entity types, 3 archetypes, 5 spells, 4 items in content packs
- D10: Fog of war - rooms revealed when adjacent room entered

## Skills (Reusable Patterns)

### KAPLAY Scene Pattern
Scenes use a `render()` function that destroys all tagged objects and re-creates them.
Tag everything with a scene-specific tag (e.g., "ui", "hud", "menu", "combat-ui", "dlg").
Call `k.destroyAll("tag")` before re-rendering. Simple and avoids stale UI state.

### Content Pack Loading
Fetch JSON from `public/data/` at startup. Use singleton ContentManager with typed getters.
`import.meta.env.BASE_URL` ensures correct paths in both dev and production.

### State Composition
Entity stats = entityType.baseStats + archetype.statModifiers.
Loop over modifier keys, add to base. Initialize currentHp/currentMana from maxHp/maxMana.

## Iteration Notes
- Built all phases in a single pass rather than iterating because the requirements were clear.
- The workflow tracker served as a checklist to verify all criteria before building.
- No significant blockers encountered. KAPLAY v3001 API is straightforward with non-global mode.
