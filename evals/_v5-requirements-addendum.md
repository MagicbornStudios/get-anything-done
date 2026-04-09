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

---

## v5 — additional requirements from Bare v5 playtest (2026-04-09)

Captured after user played Bare v5 on the deployed site. Bare v5 scored 0.805 rubric aggregate (highest ingenuity of round 4) and surfaced another pass of requirements that belong in v5 before round 5 runs.

### R-v5.13 · Combat model must be explicitly chosen (**amends G1 + G4**)

The combat system must be one of two named models, chosen and documented in the requirements themselves before implementation:

**Model A — Rule-based simulation (Unicorn-Overlord-style, user's preference).**
- Encounters are simulated from loadout + spells + skills + stats + level + traits.
- **Board positioning:** chess-like grid where each entity occupies a cell, adjacency and range matter.
- **Action policies:** every entity has an ordered list of rule-based actions driven by its traits. Player authors action policies for their own party; enemies have authored action policies per species/trait.
- **Initiative:** turn order derived from stats + policy, not menu selection.
- Player inputs are loadout + policies + positioning; combat resolves automatically with clear log.

**Model B — Direct-control combat** (simpler, less ingenuity ceiling).

v5 picks **Model A** unless an implementation exception is granted. "No targeting" observed in Bare v5 is only acceptable under Model A where rules drive targeting automatically.

### R-v5.14 · Action policies driven by entity traits (both enemies AND NPCs)

Every entity with agency has an action-policy block keyed to its traits.

- Enemies: trait `aggressive` → priority 1 is attack; `territorial` → priority 1 is hold position; etc.
- **NPCs get action policies too, not just enemies.** NPC dialogue options and behavior change as their traits (or the player's traits) shift.
- Example: a `greedy` merchant charges 20% more when player is `famous`; a `scholarly` NPC reveals rune lore only if player `affinity.arcane > 0.5`.
- Dialogue must become more prevalent overall — NPC interaction is a first-class gameplay loop, not a decoration.
- **Rationale:** "action policies based on priorities set by the player as rules, then there was initiative and the like for turn of events, this game should have action policies driven by whatever entities traits. like npcs should have action policies based on traits, and different dialogue options as those traits change for the player and the npcs when dialogue is more prevalent."

### R-v5.15 · Real-time game-time model (remove tick system)

Game time progresses in real time with a fixed real-to-game ratio. Default: **1 real hour = 1 in-game day.**

- Remove any per-tick redraw loop. Use event-driven updates only.
- Day/night cycle exists as game state and can drive encounter tables, merchant stock, NPC availability.
- **UI time-of-day shading is a SOFT requirement** (bonus scored dimension, not gate). If performant, the UI tints shift across in-game day phases.
- **Rationale:** "ticks dont seem to be playing a role really so lets remove that and just have it in realtime/game time. like 1 hr for us is 1 day. I think it would be cool to have the ui reflect the time change as shades if performant (new requirements, but should not be strict)."

### R-v5.16 · Affinity reward loop

Boosting a rune's affinity must produce a **visible, valuable reward** — not just a stat increment hidden on a sheet.

- Suggested rewards at affinity thresholds: new rune variant unlocked, existing spells using that rune gain a visual effect tier, new spell combinations become craftable, access to an affinity-gated event or NPC.
- At least one affinity reward must be visible in the forge UI (e.g. an affinity progress bar with named milestones).
- **Rationale:** "I am not sure what to do with more affinity if I boosted a rune a lot. there is no obvious reward in doing so when trying it out. users will want to be curious."

### R-v5.17 · Central visual navigation map with player location (**amends R-v5.12 + G3**)

Stronger form of R-v5.12. The navigation view must be a persistent, reachable, visual map:

- Accessible from a single button/keystroke at any time in exploration mode.
- Shows the **player token** on its current room, **room type icons**, **discovered vs undiscovered rooms**, **cleared vs active rooms**, and **visible exit connections** between rooms.
- Clicking an adjacent room must move the player there in one action (no nested dropdowns).
- Minimum layout: 2D node graph. Preferred layout: 2D grid or spatial floor map.
- **Rationale:** "navigation of exits and rooms and etc is very difficult with just the options and no real visual guide but a drop down at times. im fine with the room system, but we need some central navigation system we can repeatedly go to that is visual and have player representation and location."

### R-v5.18 · Visual player vs enemy identity in encounters

Encounter rendering must make it obvious which visual element is the player and which is the enemy.

- Distinct portrait, positioning, or color treatment for player and enemies.
- Reference style: **Pokemon or Unicorn Overlord** (user prefers UO).
- No rendering where the player cannot visually distinguish themselves from the first enemy without reading text labels.
- **Rationale:** "it is not clear that i am the seeker/vs the enemies like ooze in the encounters for the bare eval."

### R-v5.19 · Spells as craftable ingredients + procedural-but-semantic naming

Spell crafting accepts **runes AND existing spells** as ingredients.

- A spell used as an ingredient consumes or copies from the existing spell (design choice explicit).
- Combining two spells or a spell + rune produces an **evolved spell** with procedurally generated but semantically meaningful naming.
- Naming scheme must be **consistent but varied** — similar combinations produce similar names, slight differences produce slightly varied names. Not too verbose.
- Example scheme: root spell + modifier noun keyed to added element/spell. e.g. "Fireball" + Ice rune → "Frostfall Ember". Two Frostfall Embers fused → "Glacial Ember" (same family, progressed).
- **Rationale:** "we should be able to evolve spells by mixing runes and other spells together. spells themselves and the fundamental runes should be ingredients for new spells. spells created like this can be procedural and will need a consistent naming scheme that isnt too verbose, but can vary. so the choosing of a name should be more semantically create when being procedural to describe similar things, even if they are slightly different."
- This requirement **mirrors the emergent-evolution working hypothesis (gad-68)**: the in-game rune/spell/merge system is an explicit narrative analogue for the agent's skill-authoring/merge loop. Users get to feel the hypothesis being tested.

### R-v5.20 · Rune uniqueness within a single spell (**bug fix**)

A spell may not include the same rune twice in its ingredient list.

- Selecting rune X, then rune X again for the same spell must be rejected or de-selected.
- The same rune CAN appear across different spells in the player's spellbook — the constraint is per-spell, not per-player.
- Affinity gain must be calculated based on unique rune slots actually consumed.
- **Observed bug (Bare v5):** crafting with the same rune twice doubled that rune's affinity gain. Logged in `data/bugs.json`.
- **Rationale:** "a bug in the rune forge where i can select and craft 2 runes will increase its affinity of both runes. while I do want that, it should not be the case for the same spell that we have."

### R-v5.21 · Event-driven rendering (remove per-tick redraws)

All UI updates must be event-driven, not per-tick.

- No redraw loops firing at a fixed rate regardless of state changes.
- Observable symptom to eliminate: glitchy redraws on button clicks, observed across ALL round-4 builds (GAD v9/v10, Bare v5, Emergent v4). This is a perf-and-stability gate failure mode.
- Acceptable patterns: React reconciliation on state change, requestAnimationFrame scheduling only when animation is active.
- **Rationale:** "all games have had with stability is that the game glitches on button clicks and etc, like redrawing a good bit. I feel like its a performance issue involving the ticks."

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
