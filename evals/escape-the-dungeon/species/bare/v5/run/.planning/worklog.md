# Worklog — Escape the Dungeon (bare eval)

## Approach

Menu-driven roguelike, DOM-based UI (not KAPLAY canvas) because this is a turn-based, menu-heavy game and DOM yields a better UI quality score than KAPLAY primitive drawing for this style. KAPLAY is included as a dep but not used as the primary render surface — we use HTML/CSS + Iconify game-icons.

Stack: Vite + TypeScript + @iconify/react... actually NO React. Plain TS with iconify's SVG strings. We'll use `@iconify/utils` and `@iconify-json/game-icons` to grab raw SVG data and inline as strings. Alternative: `iconify-icon` web component (easiest, zero JS framework).

Chosen: **iconify-icon** web component (`<iconify-icon icon="game-icons:crossed-swords">`) — drop-in, no framework, auto-loads from CDN OR can be bundled.

## Gate plan

- **G1 loop**: title → new game → floor 1 room 1 → navigate → combat → back to rooms → 3+ transitions. Done via scenes.
- **G2 forge**: rune combination grid, 3+ combinations, one required-craft encounter per floor (enemies with specific resistances).
- **G3 UI**: CSS grid layout, game-icons everywhere, HP/mana bars as styled divs, distinct room-type panels.
- **G4 pressure**: (1) Resource pressure — mana is scarce, rest rooms cap-heal only. (2) Enemy counterplay — floor 1 boss resists fire, requires ice/poison crafted spell. (3) Encounter design — elite rooms with modifiers. Forge interaction: crafted spells bypass resistances.

## Dungeon (authored)

### Floor 1 — The Damp Catacombs (theme: resistant to physical)
- r1_entry (start) → combat, rest
- r1_combat_a (combat slimes)
- r1_rest (rest, cap 60%)
- r1_forge (forge)
- r1_elite (elite: Stone Warden — resists physical, requires crafted spell)
- r1_event (event: choice)
- r1_boss (boss: Fungal Sovereign — immune to fire, weak to ice)

### Floor 2 — The Ember Vault (theme: reflect direct damage)
- r2_entry → forge, combat
- r2_forge
- r2_combat_a (combat embers)
- r2_rest
- r2_elite (elite: Mirror Djinn — reflects direct damage, needs DoT)
- r2_boss (boss: Pyre Lich — needs DoT/indirect)

## Runes (5)

- F (Fire) — direct fire damage
- I (Ice) — ice + slow
- P (Poison) — DoT
- B (Bolster) — heal/shield self
- S (Surge) — bonus damage multiplier

## Starter spells

- Firebolt (F) — 6 dmg, 3 mana
- (nothing else — forces player to forge)

## Starter skill

- Slash (physical) — 4 dmg, no mana
  — insufficient for physical-resistant floor 1

## Crafting combinations (authored)

- F+F = Inferno (12 fire dmg, 6 mana)
- F+I = Frostfire (8 dmg, applies slow, 5 mana)
- I+P = Venom Shard (5 dmg + 3 DoT for 3 turns, 4 mana) ← key for f1 boss & f2 enemies
- P+P = Plague (2 dmg + 4 DoT for 4 turns, 5 mana) ← f2 boss killer (indirect)
- B+S = Battle Hymn (heal 8, +50% dmg next 2 turns, 4 mana)
- F+S = Meteor (15 dmg, 8 mana) but also costs 1 crystal
- I+I = Blizzard (6 dmg AoE + 20% freeze, 6 mana)
- P+B = Antivenin (cure debuff + heal 6, 3 mana)

## Progress

- [x] Scaffold Vite project
- [x] Package.json + deps
- [x] Content JSON packs
- [x] Engine: state, room graph, combat
- [x] UI: title, dungeon, combat, forge, rest, event, boss scenes
- [x] Iconify icons
- [x] localStorage persistence
- [x] 2 floors authored
- [x] Build verified
