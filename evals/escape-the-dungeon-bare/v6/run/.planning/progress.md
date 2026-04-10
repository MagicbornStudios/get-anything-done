# Escape the Dungeon - Bare v6 Progress

## Architecture
- Vite + TypeScript, DOM-based rendering (no framework)
- Event-driven state management with subscriber pattern
- iconify-icon web component for game-icons asset library (~4000 icons)

## Completed Features
- [x] Title screen with New Game / Continue
- [x] 2 authored floors (Stone Depths, Shadow Depths) with 10-11 rooms each
- [x] Room types: Combat, Elite, Forge, Rest, Event, Merchant, Boss, Training
- [x] Auto-resolve combat (Unicorn Overlord style) with action policies
- [x] Spell crafting forge with rune combination system
- [x] Procedural spell naming (semantic: element combos produce consistent names)
- [x] Spells as ingredients (need 10+ affinity)
- [x] Unique runes per recipe enforced
- [x] Rune discovery loop (start with 2, find rest via NPCs/loot/merchants)
- [x] 3 NPCs with branching dialogue (Hermit, Shadow Witch, Spirit Lyra)
- [x] Trait system with numeric values, shifts from dialogue/combat
- [x] Merchant buy/sell system
- [x] Inventory with equipment slots (main-hand, off-hand, body, trinket)
- [x] Character sheet with stats, traits, skill tree, equipment
- [x] Skill tree with 6 unlockable physical skills
- [x] Spell loadout (6 slots) + physical skill loadout (4 slots)
- [x] Action policies (configurable, toggleable, priority-based)
- [x] Visual map with room types, player position, one-click navigation
- [x] HP/Mana/Stamina bars throughout UI
- [x] Session persistence (localStorage save/load)
- [x] Rest rooms with healing
- [x] Training dummy room for safe affinity grinding
- [x] Floor boss gates (defeating boss unlocks next floor)
- [x] Pressure mechanics: resource pressure (mana/stamina), enemy counterplay (resistances/weaknesses), encounter design (boss mechanics), build pressure (loadout limits)
- [x] Affinity gained by casting spells in encounters
- [x] Game clock (day/time based on real elapsed time)
- [x] Keyboard shortcuts (M=map, I=inventory, C=character, Esc=close)
- [x] Transient notifications with auto-dismiss
- [x] Event-driven rendering (no per-tick redraws)
- [x] Flee option in combat
- [x] Victory and Game Over screens

## Gate Compliance
- G1: Full game loop - Title -> New Game -> exploration -> combat -> return -> continue
- G2: Forge with ingenuity - crafted spells needed for elite/boss encounters (resistances)
- G3: UI quality - iconify game-icons throughout, styled buttons, bars, panels, map
- G4: Pressure - resource (mana/stamina), counterplay (resistances), encounter design (boss), build (loadout limits)
