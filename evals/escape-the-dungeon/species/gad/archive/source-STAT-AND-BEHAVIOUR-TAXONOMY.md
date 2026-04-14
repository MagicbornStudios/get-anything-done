# Stat and behaviour taxonomy

Single source of truth for how we name and group stats, currency, room behaviour, and rune progression. Gameplay design, content schemas, and engine code should align with this document.

---

## 1. Combat stats

Definition: Numeric stats used for combat resolution, mitigation, and current/max pools for health and mana.

| Stat | Meaning | Engine | Content lookup id |
|------|---------|--------|-------------------|
| Might | Physical attack strength | `entity.combatStats.might` | `stat_combat_might` |
| Agility | Speed and accuracy | `entity.combatStats.agility` | `stat_combat_agility` |
| Insight | Mental or spell accuracy | `entity.combatStats.insight` | `stat_combat_insight` |
| Willpower | Mental resilience | `entity.combatStats.willpower` | `stat_combat_willpower` |
| Defense | Damage reduction | `entity.combatStats.defense` | `stat_combat_defense` |
| Power | Spell damage scaling | `entity.combatStats.power` | `stat_combat_power` |
| Current HP | Current health pool | `entity.combatStats.currentHp` | `stat_combat_current_hp` |
| Max HP | Maximum health | `entity.combatStats.maxHp` | `stat_combat_max_hp` |
| Current mana | Current mana pool | `entity.combatStats.currentMana` | `stat_combat_current_mana` |
| Max mana | Maximum mana | `entity.combatStats.maxMana` | `stat_combat_max_mana` |

Canonical content: `lookup_combat_stats.json`. Pack ids remain authored ids like `stat_combat_might`, but runtime entity maps use the plain `entityKey` values like `might` and `currentMana`.

---

## 2. Skill stats

Definition: Fixed style-axis proficiency, separate from combat resolution stats.

Canonical runtime map: `entity.skillStats`

Canonical keys:

- `Slashing`
- `Bludgeoning`
- `Ranged`
- `Magic`

Canonical content: `lookup_skill_stats.json`. Content ids can stay prefixed, but runtime entities use the plain lookup `entityKey` values.

---

## 3. Narrative / progression stats

Definition: A single set of named numeric variables used for dialogue, unlocks, narration, archetype fit, and progression.

Canonical runtime map: `entity.narrativeStats`

Canonical list:

- `Comprehension`
- `Constraint`
- `Construction`
- `Direction`
- `Empathy`
- `Equilibrium`
- `Freedom`
- `Levity`
- `Projection`
- `Survival`
- `Fame`
- `Effort`
- `Awareness`
- `Guile`
- `Momentum`

Canonical content: `lookup_narrative_traits.json`. Pack ids remain `trait_<Name>` while runtime entity maps use the plain names like `Fame` and `Comprehension`.

Authoring conventions:

- Archetypes use `narrativeProfile`
- Skills use `narrativeProfile` and `narrativeStatBonus`
- Events use `narrativeStatDelta`

Do not use the word `features` to mean these stats in design, schema docs, or user-facing text. Reserve `feature` for room type or for abstract space-model basis vectors only.

---

## 4. Rune affinity

Definition: Per-rune progression used for forging, evolution, and affinity gates. Not part of the narrative stat set.

- Engine: `entity.runeStats`
- Keys: rune ids like `rune_d`, `rune_v`
- Content: `lookup_runes.json` and `config_rune_affinity.json`

---

## 5. Currency

Definition: Mana crystals and similar economy items. Not stored as a numeric stat map on the entity.

- Representation: inventory-based items
- Use: rune forge costs, purchases, reward economy

---

## 6. Room features

Definition: Room type and behaviour. This is not an entity stat system.

Canonical list:

- `corridor`
- `start`
- `exit`
- `stairs_up`
- `stairs_down`
- `escape_gate`
- `training`
- `dialogue`
- `rest`
- `treasure`
- `rune_forge`
- `combat`

Use `room.feature` for this concept. Do not use `feature` as a synonym for narrative stats.

---

## Summary table

| Category | What it is | Engine | Canonical content |
|----------|------------|--------|-------------------|
| Combat stats | Combat resolution and mana/health pools | `entity.combatStats` | `lookup_combat_stats.json` |
| Skill stats | Style-axis proficiency | `entity.skillStats` | `lookup_skill_stats.json` |
| Narrative stats | Dialogue, unlocks, archetype fit, progression | `entity.narrativeStats` | `lookup_narrative_traits.json` |
| Rune affinity (per-rune stat) | Per-rune progression (keys = runeId) | `entity.runeStats` | Axes: `lookup_runes.json`. Rules (cap, gain, decay, gates): `config_rune_affinity.json` |
| Currency | Inventory economy items | `entity.inventory` | `content_items.json` |
| Room features | Room type / behaviour | `room.feature` | room packs and templates |

---

## Cross-references

- Naming and migration detail: `ENTITY_STATS_CONVENTION.md`
- Gameplay design: `.planning/GAMEPLAY-DESIGN.xml`
