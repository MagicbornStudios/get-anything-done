# CHANGELOG -- Escape the Dungeon, Emergent v5

## Skill Dispositions

See `game/.planning/skills/CHANGELOG.md` for full details.

| Inherited Skill | Disposition | Notes |
|---|---|---|
| create-skill.md | KEPT | Used to author 2 new skills |
| find-sprites.md | KEPT | Drove iconify-icon + game-icons choice |
| content-pack-loading.md | KEPT | Applied verbatim (BASE_URL, try/catch) |
| game-loop-verification.md | KEPT | Verified loop after every phase |
| previous-workflow.md | KEPT | Historical reference for decisions |
| dom-over-kaplay.md | KEPT | Core architecture choice -- full DOM, no canvas |
| pressure-forge-coupling.md | EVOLVED | Extended with hunger + mana drain pressure |
| kaplay-scene-pattern.md | DEPRECATED | 3rd consecutive skip; obsoleted by dom-over-kaplay |
| state-composition.md | DEPRECATED | Subsumed by getEffectiveStats pattern |

## New Skills Authored

| Skill | Purpose |
|---|---|
| auto-resolve-combat.md | Unicorn Overlord style: setup + auto-execute with pause |
| trait-driven-gameplay.md | Visible numeric traits driving combat + dialogue |

## v5 Requirements Coverage

| Req | Status | Notes |
|---|---|---|
| G1 GAME LOOP | Done | Title -> New Game -> rooms -> combat -> return -> continue |
| G2 FORGE WITH INGENUITY | Done | F1: direct-resist -> DoT counter; F2: reflect -> DoT/bypass |
| G3 UI QUALITY | Done | All iconify-icon, HP/mana bars, styled controls, themed panels |
| G4 PRESSURE | Done | Hunger (increases over time) + Mana drain (Manaweaver) |
| R-v5.01 Affinity by casting | Done | Tracks element cast counts, displayed in sidebar |
| R-v5.02 Rune discovery | Done | Runes drop from enemies, from dialogue rewards |
| R-v5.03 Merchants | Done | 2 merchants with equipment/consumables |
| R-v5.04 NPC dialogue branching | Done | 2 NPCs with 3 branches each, trait shifts, rewards |
| R-v5.05 Inventory + equipment | Done | Equipment slots (weapon/offhand/accessory), consumables |
| R-v5.06 Character sheet + skill tree | Done | 8-node skill tree with prerequisites |
| R-v5.07 Loadout slots | Done | 4 spell slots configurable before combat |
| R-v5.09 Session persistence | Done | localStorage save/load with version compat |
| R-v5.12/17 Visual nav map | Done | Map view with visited/cleared/current indicators |
| R-v5.13 Auto-resolve combat | Done | Unicorn Overlord: setup policies -> auto-execute -> pause |
| R-v5.14 Trait system | Done | aggression/compassion/cunning, visible numeric values |
| R-v5.18 Player vs enemy identity | Done | Player = knight-helmet (blue), Enemy = unique icon (red) |
| R-v5.19 Spells as ingredients | Done | Rune elements combine at forge into spells |
| R-v5.20 Unique ingredients | Done | 5 unique rune elements with distinct icons |
| R-v5.21 Event-driven rendering | Done | State change -> full re-render of current view |
