# v5 Requirements Addendum — Round 4 Playtest Feedback

**Status:** draft. To be merged into `escape-the-dungeon{,-bare,-emergent}/template/.planning/REQUIREMENTS.xml` as a full v5 promotion before round 5 is run. Captured live from user playtest of Bare v5 and Emergent v4 on 2026-04-09.

**Anchor decisions:** gad-41 (pressure over features), gad-65 (compound-skills hypothesis). v5 refines v4's pressure direction with progression, inventory, and NPC loops demanded by actual play.

---

## Source — what the playtest surfaced

User played the deployed builds on `get-anything-done.vercel.app/playable/...`. Quotes in this doc are paraphrased from their written feedback unless marked verbatim.

**Bare v5 — no new requirements surfaced from this run in this addendum.**

**Emergent v4 — detailed feedback drove the entire addendum below.** Rubric aggregate 0.805 (weights on escape-the-dungeon-emergent/gad.json). Strengths: UI is "incredible" and book-like, icons + animated encounters, battle log, resistance/DoT/stacking mechanics, pressure felt, forge coupling works, mana crystals, potions wired, first full skill ratcheting cycle observed. Weaknesses became requirements.

---

## v5 — new and changed requirements

### R-v5.01 · Training via encounter, not menu (**amends G2**)

Affinity must increase as a **side effect of casting spells in encounters**, not as a direct menu action.

- Remove any "select affinity → train" menu that picks the trained element for the player.
- Introduce a **Training Dummy encounter** (low-XP, no-loot combat room type) whose only purpose is letting the player cast without risk so affinity rises through use.
- Any room with combat must produce affinity gain for the elements/runes the cast spell used. The forge becomes a place to *forge and combine*, not to train.
- **Rationale:** matches user mental model that "the casting of those spells is what increases rune affinity." Direct training menus turn a discovery loop into a shopping list.

### R-v5.02 · Rune discovery as a gameplay loop

Not all runes are listed/available at game start. Runes must be **discovered** across the dungeon.

- Starter inventory contains a small subset of runes (2-3). The rest are found as loot drops from combat/elite encounters, hidden in event rooms, sold by merchants, or awarded by NPC dialogue outcomes.
- The rune forge UI must visibly distinguish **known** vs **undiscovered** runes (locked slots, `???`, or similar).
- At least one rune per floor must be gated behind a non-combat interaction (event, dialogue, hidden room).
- **Rationale:** "we need to make a portion of the game about finding the runes to build the spells." Forge ingenuity only matters if the ingredient set itself is an exploration reward.

### R-v5.03 · Merchants with buy/sell/trade

The dungeon must contain at least one merchant encounter per floor.

- Merchant room type. Inventory of runes, potions, and items with gold cost.
- Three operations: **buy** (cost gold), **sell** (gain gold), **trade** (exchange owned item for stocked item with a relative value rule).
- Gold or an equivalent currency becomes a tracked resource.

### R-v5.04 · NPC dialogue with branching outcomes

Authored NPCs must appear in the dungeon with dialogue options that **trigger items, events, or combat**.

- At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.
- Dialogue choices must cause persistent game state changes: item gain, rune unlock, enemy spawn, merchant discount, quest flag.
- **Rationale:** "we need to encounter npcs that give us dialogue and items/events we can trigger based on dialogue options."

### R-v5.05 · Inventory / bag with grid and equippable items

Player must have a visible inventory UI.

- Bag with a finite grid of slots.
- Items have categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket, focus, etc.).
- **Equipment slots** must exist on a character sheet with at least: main-hand, off-hand, body, trinket.
- Equipping an item must affect combat stats or spell outputs in a measurable way.
- Items must drop from combat, events, and merchants.
- **Rationale:** "we dont have an inventory/bag and grid/equippable items and arent finding items."

### R-v5.06 · Visible character sheet with combat + physical skills and a skill tree

Player must be able to inspect their character at any time.

- Panel showing: HP, mana, affinities, physical/combat stats, resistances, equipped items, known spells, known physical skills.
- **Skill tree** or equivalent progression graph for physical/combat skills, separate from spells.
- Physical skills cost stamina or a non-mana resource to distinguish from spells.
- **Rationale:** "I dont see my combat stats or physical skills outside of spells. or a skill tree."

### R-v5.07 · Spell slots and skill slots (loadout constraint)

When the player has many spells/skills, they must choose which to equip.

- Fixed-size **spell loadout** (suggested: 4-6 equipped slots out of all known spells).
- Fixed-size **physical skill loadout** (suggested: 2-4 equipped slots).
- Loadout can only be changed in rest rooms or at specific stations, not mid-combat.
- **Rationale:** "we are going to have many spells to choose from so there will need to be skill slots and spell slots." Ties into pressure gate G4 as a **build pressure** mechanic.

### R-v5.08 · Progression sources sufficient to reach end boss (**amends G1**)

Final-floor boss must be defeatable by a player who engaged with the intended loops. There must be enough exp/mana/item sources along the path that a fully-crafted build can overcome the warden-class boss.

- Respawning encounters on cleared floors (already allowed in v4) must give **meaningful** progression — not asymptotic crumbs that leave the player stuck.
- At least one guaranteed mana-max or spell-power upgrade per floor (item, event reward, merchant purchase).
- **Rationale:** "i cant beat the boss in the emergent game... I have no real clear way to get stronger or get more mana to cast more spells." A pressure gate that is unwinnable is indistinguishable from a softlock.

### R-v5.09 · Save checkpoints and continue after death (**amends G1**)

Death must not hard-brick the save.

- On new game, create a save slot and checkpoint it on room-clear (or floor-clear at minimum).
- On death, "Continue" must load the most recent checkpoint, not be greyed out.
- On manual exit from title screen, re-entering must still offer Continue.
- **Rationale:** "I died and failed the game, but can't select continue anymore. so there are no player save checkpoints automatically."

### R-v5.10 · Notification lifecycle (**amends G3 stability**)

Toast/notification elements must auto-dismiss and must not persist across game sessions.

- Every notification has a timeout (suggested: 3-5s) or explicit dismiss control.
- Starting a new game must clear any in-flight notifications from the previous session.
- Reloading the page must not restore stale notifications.
- **Rationale:** "notifications like trained fire affinity are staying above the screen" and "I just did a new game and those notifications are still above the emergent's latest game build."

### R-v5.11 · Rest rooms must offer rest (**amends v4 room-types**)

Any room typed `Rest` (including the rune forge rest variant) must expose a **Rest** action that restores HP/mana and allows loadout changes.

- Forge rooms may combine Forge + Train + Rest actions, but **Rest must be one of the action buttons** if the room claims Rest as a room type.
- **Rationale:** "im supposed to be able to rest in the rune forge room. but I only have forge and train."

### R-v5.12 · Navigation and map usability (**amends G3**)

Map/navigation UI must be more than a linear list.

- Map view must show at minimum a **2D graph layout** of discovered rooms with current position, cleared/uncleared state, and available exits.
- Navigation from the map must be one click, not a multi-step menu.
- **Rationale:** "navigation in the emergentv4 is difficult and the map is just a list."

---

## Explicitly deferred to v6

- Deep evolution trees (multi-stage mutations) — still deferred.
- Rune affinity *decay* when unused — still deferred.
- Multi-character party play — out of scope for escape-the-dungeon family.

---

## Gate impact summary

v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality, G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable), G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and introduce new scored dimensions for **inventory_and_equipment_present** and **npc_dialogue_present** rather than new gates — so a run missing those does not get gate-zeroed but takes a meaningful scored hit.

## Human-review rubric impact

No rubric dimension weights change for v5. New requirements surface inside `playability`, `mechanics_implementation`, and `ingenuity_requirement_met`. The emergent-only `skill_inheritance_effectiveness` dimension is unchanged.

## Next action

Before round 5 is prompted: promote this addendum into a real v5 `REQUIREMENTS.xml` for all three escape-the-dungeon greenfield projects, bump `requirements_version` in template gad.json, and append a v5 section to `REQUIREMENTS-VERSIONS.md`. Do not run round 5 against v4.
