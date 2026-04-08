# Brownfield extensions (v4)

Shared extension requirements for all `etd-brownfield-*` evals. These describe what
features to ADD to the existing bare v3 codebase (which you inherit as the starting state).

**Baseline:** `escape-the-dungeon-bare v3` — a playable roguelike with title, rooms,
combat, dialogue, menus, save/load, and content packs. Missing: floor progression,
rune forge, skills system, rich visuals.

**Your job:** Extend this codebase with the features below. Do NOT rebuild from scratch.
Keep what works, fix what's broken, and add the new systems.

## Required additions (gates)

### G1 — Floor progression
- After defeating the floor boss, player unlocks the next floor
- New floor has new rooms, new enemies, potentially new room types
- Progress is saved (can continue to unlocked floors after reload)
- Player can backtrack to previous floors if desired

### G2 — Respawning encounters (grinding)
- Combat rooms on a cleared floor can be re-entered to fight respawned enemies
- Respawn cadence is balanced (not every entry, but reasonable for XP farming)
- This lets players grind for XP, crystals, and rune affinity before taking on bosses

### G3 — Rune forge with affinity system
- Player can access the forge at forge rooms OR a mana crystal cost at any rest room
- Select 2+ runes to craft a spell. The resulting spell reflects the runes chosen
- **Rune affinity**: each rune the player uses in combat builds affinity for that rune
- Higher affinity unlocks stronger spell variants ("evolutions") that require minimum
  affinity thresholds
- **Specialization vs decay**: affinity in unused runes slowly decays, so players choose
  a specialization rather than maxing everything
- Player can train affinity at the forge by spending XP (cheaper than combat grinding)
- Player can author their own spell names and save them to the spellbook

### G4 — Skills system (physical actions, separate from spells)
- Skills are physical actions: Slash, Bash, Parry, Guard, etc.
- Skills cost nothing (no mana) but have cooldowns or turn delays
- Skills gain XP through use and evolve via their own skill experience (not rune affinity)
- Skills can be **supercharged by expending mana crystals** to add extra damage or effects
  (e.g., burn, bleed, stun, knockback)
- Minimum: 3 starter skills, at least 1 that evolves, at least 1 that can be supercharged

### G5 — Visual upgrade
- Source and use actual sprites/tilesets (install an npm package or web-search for free
  assets). No raw ASCII/text-only UI.
- Room-type icons, entity sprites/portraits, HP/mana bars, styled panels

## Retained from v3 gates

- **Game loop** must still work end-to-end: title → new game → rooms → combat → return
- **Spell crafting** from v3 — crafted spells should now interact with the new affinity
  system
- **UI quality** remains a gate

## Nomenclature update

In the game UI, display narrative/progression stats as **"Traits"** (not "Narrative Stats").
The code can still use `narrativeStats` internally, but the player-facing label is "Traits".

## What NOT to do

- Don't rewrite working v3 code unless you have to
- Don't introduce new frameworks beyond what v3 already uses
- Don't silently break existing gates — if a v3 feature stops working, that's a regression

## Scoring

Same v3 composite formula with human_review weighted 0.30. Gate violations zero the
requirement_coverage. The low-score caps still apply.

## Baseline code location

The bare v3 codebase is at `vendor/get-anything-done/evals/escape-the-dungeon-bare/v3/run/`.
For brownfield evals, this directory's contents are copied into `game/` at the start of
the run as your starting point.
