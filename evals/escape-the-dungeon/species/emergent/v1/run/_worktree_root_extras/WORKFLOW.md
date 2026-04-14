# Workflow: Escape the Dungeon (Emergent v1)

## Lessons from previous run
- New Game button didn't work -- MUST verify title->game flow first
- 1 giant commit -- commit after each phase
- No verification -- run dev server after each phase
- Skills written after the fact -- write immediately when hitting problems

## Phases

### Phase 1: Scaffold + Title Screen [status: done]
- Vite + TS + KAPLAY project setup
- Title screen with "New Game" button
- Click New Game -> transitions to game scene
- VERIFY: npm run dev, click New Game, see game scene

### Phase 2: Room Navigation [status: done]
- Content pack: floors.json with 3+ rooms
- Room scene showing description, exits as buttons
- Navigate between rooms via button clicks
- HUD: player name, HP, mana, floor
- VERIFY: navigate between rooms, HUD updates

### Phase 3: Combat System [status: done]
- Combat scene: enemy display, HP bars
- Fight action with damage calculation
- Victory/defeat flow
- VERIFY: enter combat room, fight enemy, win/lose

### Phase 4: Dialogue + NPCs [status: done]
- Dialogue scene with NPC text and choices
- Content pack: dialogue.json
- VERIFY: enter dialogue room, talk to NPC

### Phase 5: Spells + Items [status: done]
- Pre-made spells usable in combat
- Basic inventory with potions
- Stats/Bag menu
- VERIFY: cast spell in combat, use item

### Phase 6: Save/Load + Polish [status: done]
- localStorage persistence
- Auto-save on room entry
- Treasure rooms
- Rest rooms (heal)
- VERIFY: save, refresh, load works

### Phase 7: Production Build [status: done]
- npm run build
- Test with npx serve game/dist
- Write ARCHITECTURE.md
- Write skills/CHANGELOG.md
- Final commit with dist/
