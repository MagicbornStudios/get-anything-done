# Eval: escape-the-dungeon v4


You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Agent guide — Escape the Dungeon (eval project)

**You are inside a GAD eval.** Follow this loop exactly. Your work is being traced.

## The loop (mandatory)

1. **Read context:** `gad snapshot --projectid escape-the-dungeon` or read `.planning/STATE.xml`
2. **Pick one task** from `.planning/TASK-REGISTRY.xml` (status=planned)
3. **Mark it in-progress** in TASK-REGISTRY.xml before starting work
4. **Implement it**
5. **Mark it done** in TASK-REGISTRY.xml
6. **Update STATE.xml** — set `next-action` to describe what comes next
7. **Commit** with a message referencing the task id (e.g. "feat: 02-03 render floor map")
8. **Repeat** from step 2

## Before you start coding

You MUST do these first:
1. Read `.planning/REQUIREMENTS.xml` — what you're building
2. Read `.planning/phases/01-pre-planning/01-CONTEXT.md` — decisions already made
3. Plan your phases in `.planning/ROADMAP.xml` if not already planned
4. Create tasks in `.planning/TASK-REGISTRY.xml` for your first phase

## Per-task checklist

Before moving to the next task, verify:
- [ ] TASK-REGISTRY.xml: previous task marked `done`
- [ ] STATE.xml: `next-action` updated
- [ ] Code compiles (`npx tsc --noEmit` or equivalent)
- [ ] Committed with task id in message

## After first implementation phase

If this is a greenfield project and no `CONVENTIONS.md` exists yet:
- Create `.planning/CONVENTIONS.md` documenting the patterns you established:
  - File structure and naming
  - Import/export patterns
  - Content pack format
  - Scene/component registration pattern
  - Type conventions

## Decisions during work

When you make an architectural choice (e.g. "use Vite not Webpack", "scenes are functions not classes"), capture it in `.planning/DECISIONS.xml`:

```xml
<decision id="etd-01">
  <title>Short title</title>
  <summary>What you decided and why</summary>
  <impact>How this affects future work</impact>
</decision>
```

## What NOT to do

- Do NOT skip TASK-REGISTRY.xml updates — your trace depends on them
- Do NOT batch all planning updates at the end — update per task
- Do NOT ignore STATE.xml — it's how the next agent knows where you stopped
- Do NOT code without planning first — phases and tasks must exist before implementation

## Source material

- `source-GAMEPLAY-DESIGN.xml` — full game design (640 lines)
- `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` — stat names and engine mappings
- `.planning/phases/01-pre-planning/01-CONTEXT.md` — pre-planning decisions

## Build and verify

```sh
cd game/
npm run dev        # dev server
npx tsc --noEmit   # type check
npm run build       # production build
```


## REQUIREMENTS.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!--
  Eval project: Escape the Dungeon
  Source: GAMEPLAY-DESIGN.xml + STAT-AND-BEHAVIOUR-TAXONOMY.md
  Purpose: Test GAD planning loop on a real game implementation
-->
<requirements>
  <goal>Build a playable roguelike dungeon crawler web game called "Escape the Dungeon" using the GAD planning loop. Player navigates a 12-floor dungeon via room graph, negotiates or fights, crafts spells from 26 runes, and escapes past floor bosses.</goal>

  <audience>Solo player (keyboard + mouse). Content-driven, designer-tunable via JSON packs. Target: KAPLAY (web/JS).</audience>

  <success-criteria>
    <criterion>Player can start a new game, see intro beat, and navigate rooms via exit choices on floor 1</criterion>
    <criterion>Combat interaction view works: target slot, Fight/Spells/Bag/Run, HP/mana tracking</criterion>
    <criterion>Dialogue interaction view works: NPC portrait, dialogue options, trait-gated choices</criterion>
    <criterion>Rune forge interaction view: craft spells from runes, evolve spells, assign spell slots</criterion>
    <criterion>Dungeon tick system advances on room entry, boss spawns enemies every 3 ticks</criterion>
    <criterion>Spell system: 26 runes, spell composition, rune affinity tracking, evolution at forge</criterion>
    <criterion>Entity model: entity type, archetype (from title), occupation, party role — all content-driven</criterion>
    <criterion>XP/leveling, Fame/deeds/livestream, mana/crystal economy all functional</criterion>
    <criterion>Save/load persists full game state</criterion>
    <criterion>Floor map shows room grid, room-type icons, fog/discovery, selected destination highlight</criterion>
    <criterion>Top-level menus: Map, Bag, Journal (Quests/Bestiary/Guides), Spellbook, Stats, Equipped, Settings</criterion>
    <criterion>All game data lives in content packs (JSON) — no hardcoded game rules in code</criterion>
  </success-criteria>

  <non-goals>
    <item>Unreal Engine port — KAPLAY web only for this eval</item>
    <item>Tile-based movement or 2D grid walking — navigation is choice-driven via room graph</item>
    <item>Similarity/vector/distance-based content selection — all content is authored and static</item>
    <item>Rebalancing tooling — make the game first, tune later</item>
    <item>Multiplayer or networking</item>
    <item>Full 50 titles + 50 archetypes content — minimum viable content for 12 floors</item>
  </non-goals>

  <source-docs>
    <doc path="source-GAMEPLAY-DESIGN.xml" role="Full gameplay design specification" />
    <doc path="source-STAT-AND-BEHAVIOUR-TAXONOMY.md" role="Canonical stat names, groupings, and engine mappings" />
  </source-docs>

  <core-systems>
    <system id="navigation">Unified graph: dungeon rooms and overworld hubs use same location model. Room has id, name, description, feature, exits. No tile movement — choose exits from action panel. Floor map shows room grid with room-type icons and discovery state.</system>
    <system id="dungeon-loop">Race against time. Dungeon ticks advance on room entry. Boss spawns enemies every 3 ticks from adjacent rooms. Boss guards exit — offer golden crystal (deal) or defeat in combat.</system>
    <system id="combat">Turn-based. Player actions: Fight, Spells, Bag, Run. Summon acts after player. Combat stats: Might, Agility, Insight, Willpower, Defense, Power, HP, Mana. Win = XP + mana crystals.</system>
    <system id="spells">26 runes. Spells = ordered list of rune IDs. Create at rune forge, evolve when affinity conditions met. Spell slots (prepared subset) used in encounters. Spellbook filters by rune, type, category. Categories: conversation, transportation, exploration, combat, crafting, detection.</system>
    <system id="rune-affinity">Per-rune numeric stat (0–cap). Increases on spell cast. Gates evolution (minAffinityPerRune). Affects forge power bonus. Stored in entity.runeStats.</system>
    <system id="entities">Four layers: entityType (physical kind), archetype (build/stats from title), occupation (dungeoneer/merchant/boss), partyRole (flavor). All content-driven packs.</system>
    <system id="progression">XP from combat/quests/deeds. Level curve in content. Fame from livestream (mana per tick → Fame per tick). Deeds acquired during livestream, spread NPC→NPC.</system>
    <system id="economy">Mana crystals = currency. Spell costs, forge costs, shop purchases. Golden crystal = 10,000 value, boss deal item. Convert crystals → mana (1:10). Search rooms for treasure chests.</system>
    <system id="companions">Any spell can become a summon at forge ("give the spell life"). Max 1 active. Pokemon sprites. Acts after player in combat. No room behavior.</system>
    <system id="ui">Gameplay UI (floor map, room actions, interaction view, HUD) vs Display UI (Map, Bag, Journal, Spellbook, Stats, Equipped, Settings). Menus overlay center viewport, don't replace full screen.</system>
  </core-systems>
</requirements>
```

## REQUIREMENTS.md (eval overview)

# Eval: Escape the Dungeon

## What this eval measures

1. **Skill trigger accuracy** — are /gad:* skills triggered at the right moments (discuss before plan, plan before execute, verify after execute)
2. **Planning quality** — does the agent produce coherent phases, tasks, decisions from a complex game design doc
3. **CLI context efficiency** — does gad snapshot/context deliver what the agent needs without reading dozens of files
4. **End-to-end loop** — does the full GAD loop (discuss → plan → execute → verify → score) work on a real implementation
5. **Time-to-completion** — wall clock and token counts from requirements to working game

## Eval flow

1. Pre-planning discussion: `/gad:discuss-phase` — collect open questions, clarify requirements, record the conversation
2. Phase planning: `/gad:plan-phase` — break the game into implementable phases with tasks
3. Execution: `/gad:execute-phase` — implement each phase, update planning docs, commit
4. Verification: `/gad:verify-work` — check each phase against its definition of done
5. Scoring: TRACE.json + SCORE.md produced at end

## Source material

- `source-GAMEPLAY-DESIGN.xml` — full gameplay design (500+ lines of XML)
- `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` — canonical stat names and engine mappings
- `template/.planning/REQUIREMENTS.xml` — structured requirements derived from source docs

## Human review

After the eval agent completes, a human reviews:
- Does the game feel playable?
- Does navigation work intuitively?
- Are the UI surfaces clear?
- Is the content-driven architecture sound?

This is a manual score added to SCORE.md after the eval run.


## DECISIONS.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <!-- Decisions will be captured during discussion and implementation -->
</decisions>
```

## ROADMAP.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="01" title="Project Scaffold">
    <goal>KAPLAY + TypeScript setup, build tooling, dev server, basic HTML shell</goal>
    <status>done</status>
  </phase>
  <phase id="02" title="Core Navigation">
    <goal>Room graph data model, floor map rendering, exit selection, room transitions, dungeon tick, discovery/fog</goal>
    <status>done</status>
  </phase>
  <phase id="03" title="Game Flow and UI Shell">
    <goal>Main menu, new game flow, intro narrative beat, HUD (HP/mana/tick), game state management</goal>
    <status>done</status>
  </phase>
  <phase id="04" title="Combat System">
    <goal>Interaction view, turn-based combat, Fight/Spells/Bag/Run actions, HP/mana tracking, win/lose/flee, XP rewards</goal>
    <status>done</status>
  </phase>
  <phase id="05" title="Spell System">
    <goal>26 runes, spell composition, rune forge interaction, spell slots, affinity tracking, evolution</goal>
    <status>done</status>
  </phase>
  <phase id="06" title="Content Packs and Entity Model">
    <goal>JSON content packs for entities, archetypes, items, spells, dungeon floors; entity type/archetype/occupation/partyRole model</goal>
    <status>done</status>
  </phase>
  <phase id="07" title="Display Menus and Save/Load">
    <goal>Map, Bag, Spellbook, Journal, Stats, Settings overlay menus; save/load persistence</goal>
    <status>done</status>
  </phase>
</roadmap>
```

## STATE.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase></current-phase>
  <current-plan></current-plan>
  <milestone>escape-the-dungeon-eval</milestone>
  <status>not-started</status>
  <next-action>Plan phases in ROADMAP.xml from REQUIREMENTS.xml. Create tasks in TASK-REGISTRY.xml. Then implement phase by phase following the loop in AGENTS.md.</next-action>
  <last-updated>2026-04-06</last-updated>
</state>
```

## Source documents

### source-GAMEPLAY-DESIGN.xml

<?xml version="1.0" encoding="UTF-8"?>
<!--
  Escape the Dungeon: gameplay design (how it plays, how it's built).
  Source: product direction and Q&A. Kept in sync with phase plans and schema.
-->
<gameplay-design>
  <meta>
    <title>Escape the Dungeon – Gameplay Design</title>
    <updated>2026-03-23</updated>
    <checklist>.planning/GAMEPLAY-SPEC-CHECKLIST.md</checklist>
    <stat-and-behaviour-taxonomy>packages/engine/src/escape-the-dungeon/contracts/data/STAT-AND-BEHAVIOUR-TAXONOMY.md</stat-and-behaviour-taxonomy>
  </meta>
  <!-- Stat and behaviour definitions (combat stats, narrative/progression stats, rune affinity, currency, room features) are canonical in the taxonomy doc above. Do not redefine stat names or groupings here; reference that file so design, content schemas, and code stay aligned. -->

  <stat-catalogs-and-hub>
    <content-pack-slices>The static Game data hub groups collections into: Schema &amp; source (content schema, source maps, rarities, entity types), Stat catalogs &amp; affinity axes (narrativeStats, combatStatPack, skillStats, runePack), Gameplay rules (runeAffinity tuning, gameStats economy), then actions and narrative content. config_content_schema.statSchema lists lookupPack filenames per domain; rune domain uses lookup_runes.json for ids and entity.runeStats for live values.</content-pack-slices>
    <rune-affinity-split>Per-rune affinity is a stat map: keys = runeId from runePack, values = 0…cap on entity.runeStats. config_rune_affinity.json is only rules (gain per cast, cap, optional decay cadence, evolution gate field names, forge power bonus copy)—not the axis list.</rune-affinity-split>
    <linkage>Archetype narrativeProfile, entity narrativeStats, dialogue anchorVector/effectVector, and action formula traitDelta/featureDelta share narrativeStats entityKeys. entity.combatStats and entity.skillStats use combat and skill catalogs. Spell runeCombo and forge UI use runePack; affinity numbers use runeStats plus runeAffinity rules.</linkage>
    <combat-vs-affinity>Weapon and core combat resolution use combatStats (and authored combat formulas). Rune affinity does not replace hit rolls or melee damage dice; it progresses with spell use, may decay per rules, gates spell evolution (minAffinityPerRune), and scales authored spell contribution at the forge per spellCrafting rules.</combat-vs-affinity>
    <sprites>Optional iconSpriteUrl on narrative trait, combat stat, skill axis, rune, and rarity rows (see respective JSON schemas). When present, the review hub and in-game stat panels show the icon beside the label; deltas use the same resolver so +/− chips stay recognizable.</sprites>
  </stat-catalogs-and-hub>

  <identity>
    <one-liner>Roguelike dungeon crawl where you negotiate as much as you fight.</one-liner>
    <reference>Pokemon is a reference for encounter system, types, and sprites—not the core fantasy.</reference>
    <pacing>12+ hours per run; target ~1 dungeon floor cleared per game hour. Main drive
...(truncated)

### source-STAT-AND-BEHAVIOUR-TAXONOMY.md

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
- Keys:
...(truncated)


## Instructions


1. Copy the .planning/ directory from the template into your working directory

2. Implement the project following the ROADMAP.xml phases

3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID

4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture

5. When complete: all phases done, build passes, planning docs current