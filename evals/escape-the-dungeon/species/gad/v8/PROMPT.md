# Eval: escape-the-dungeon v8


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
7. **Commit exactly one task per commit.** Message MUST include the task id (e.g. "feat: 02-03 render floor map"). NEVER batch multiple tasks into one commit -- each task gets its own atomic commit. This is how your discipline is scored.
8. **Repeat** from step 2

## After completing each phase (all tasks done)

**Verify the phase before moving on.** Write `.planning/VERIFICATION.md` (append each phase):

```markdown
## Phase [X]: [Name]
- Build: PASS/FAIL (run the build command)
- Tasks: [N]/[N] done
- State: current (next-action points to next phase)
```

Then commit: `git commit -m "verify: phase [X] verified"`

This is mandatory — your skill accuracy score depends on it.

## Before you start coding

You MUST do these first:
1. Read `.planning/REQUIREMENTS.xml` — what you're building
2. Read the source docs — `source-GAMEPLAY-DESIGN.xml` and `source-STAT-AND-BEHAVIOUR-TAXONOMY.md`
3. Plan your phases in `.planning/ROADMAP.xml` (it's empty — you plan from scratch)
4. Create tasks in `.planning/TASK-REGISTRY.xml` for your first phase

## BUILD ORDER: UI FIRST, SYSTEMS SECOND

**Your #1 priority is a playable vertical slice.** A game with 3 rooms and visible UI
scores higher than 12 invisible backend systems. Plan your phases in this order:

1. **Project scaffold** — Vite + KAPLAY + TypeScript, dev server running
2. **Title screen + game start** — visible styled menu, "New Game" works
3. **Room navigation** — styled rooms with icons, themed colors per room type, exit buttons
4. **Combat encounter** — visible HP bars, styled action buttons, enemy representation (sprite/portrait/placeholder)
5. **Rune forge / spell crafting** — player combines runes to create spells (THIS IS A GATE — IT MUST WORK)
6. **Dialogue** — NPC portrait/representation, dialogue text, choice buttons
7. **HUD + menus** — HP/mana bars (not just numbers), styled overlay menus
8. **Content packs + save/load** — JSON data, localStorage persistence
9. **Polish pass** — verify full game loop, visual consistency, no softlocks

## THREE GATE CRITERIA (all must pass or you score 0)

**G1 — Game loop:** Title → New Game → room → navigate → combat → return → continue playing. NO SOFTLOCKS.
**G2 — Spell crafting:** Player accesses forge, combines runes, creates a spell, uses it. Loot/rewards don't count.
**G3 — UI quality:** Icons, styled buttons, HP bars, room-type visual differentiation, entity representation. NO raw ASCII/text-only UI.

If you build systems without UI, the game will show a blank screen and score 0.
If combat doesn't return to room navigation, you score 0.
If there's no rune forge, you score 0.

## UI ASSET SOURCING

You MUST make the game visually polished. Use these approaches (in order of preference):
1. Install an icon/sprite npm package (e.g. game-icons, pixel-art packs)
2. Use web search to find free game sprites/icons and download them
3. Generate placeholder art (canvas-drawn shapes, SVG icons, emoji-based)
4. Geometric fallback tiles (LAST RESORT only)

The game must look intentional, not like a debug console.

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
- Do NOT batch multiple tasks into one commit — ONE task = ONE commit. This is 20% of your score
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

## Final deliverable (MANDATORY)

Your LAST phase must produce a working production build. This is non-negotiable:

1. Run `npm run build` in `game/` — it must succeed with zero errors
2. The `game/dist/` directory must contain a playable `index.html` + assets
3. Verify the build works: the index.html should load in a browser with no 404s
4. Commit the dist/ directory: `git add game/dist/ && git commit -m "build: production dist"`

The build artifact is what gets showcased on the docs site. No dist = eval incomplete.

## Architecture doc (MANDATORY)

Before your final commit, write `.planning/ARCHITECTURE.md` describing what you built:
- System overview (1 paragraph)
- Key modules and what each does (bullet list)
- Data flow (how game state moves through the system)
- Key decisions you made and why

This is scored. 10-20 lines is enough. It proves you understand what you built, not just that it compiles.


## REQUIREMENTS.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!--
  Eval project: Escape the Dungeon
  Source: GAMEPLAY-DESIGN.xml + STAT-AND-BEHAVIOUR-TAXONOMY.md
  Requirements version history:
    v1 (2026-04-06): 12 systems-focused criteria, no gates
    v2 (2026-04-08): Added gate criteria, vertical-slice priority, UI-first mandate
    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate, revised weights
-->
<requirements version="v3" updated="2026-04-08">
  <goal>Build a playable roguelike dungeon crawler web game called "Escape the Dungeon". Player navigates a dungeon via room choices, encounters NPCs and enemies, crafts spells at a rune forge, and progresses through floors. Priority is a PLAYABLE VERTICAL SLICE with intentional visual presentation — not a raw prototype shell.</goal>

  <audience>Solo player (keyboard + mouse). Content-driven, designer-tunable via JSON packs. Target: KAPLAY (web/JS).</audience>

  <!-- ============================================================ -->
  <!-- GATE CRITERIA: All gates must pass or requirement_coverage = 0 -->
  <!-- ============================================================ -->
  <gate-criteria>
    <gate id="G1" name="game-loop">
      The complete game loop must work without softlock:
      1. Title screen renders visually
      2. Player clicks New Game and the game starts
      3. Player sees current room with description and navigation options
      4. Player navigates to another room (scene transition works)
      5. Player encounters combat — fight resolves — player returns to room navigation
      6. Player encounters dialogue — conversation resolves — player returns to room navigation
      7. Player can continue playing into additional rooms without getting stuck
      If any step in this loop is broken, the gate fails.
    </gate>

    <gate id="G2" name="spell-crafting">
      The game must include a functional spell-crafting system. During a test run:
      1. Player can access a rune forge / spell craft interface during gameplay
      2. Player selects at least two crafting inputs (runes or components)
      3. System creates or unlocks a resulting spell from the combination
      4. Crafted spell can be equipped, viewed, or used in encounters
      5. Game loop continues afterward (no softlock)
      Mere spell acquisition through loot, NPC rewards, or pre-equipped spells does NOT
      satisfy this gate. The player must intentionally craft.
      Minimum implementation floor: 3-5 runes/components, 3+ valid combinations, output
      clearly presented, crafted spell usable in encounter flow.
    </gate>

    <gate id="G3" name="ui-quality">
      The game must present a fully intentional UI, not a raw prototype shell. Required:
      - Readable and visually structured layout with spacing and hierarchy
      - Room-type icons (installable icon pack, generated, or consistent placeholder art)
      - Encounter/entity visual representation via sprite, portrait, or consistent placeholder
      - Themed visual differentiation across room types (color, background, or panel treatment)
      - Styled interactive controls (buttons with visible affordance, not raw text links)
      - HP, mana, and critical state shown as visual bars or indicators, not only numbers

      Acceptable asset sourcing (in order of preference):
      1. Lightweight installable icon/sprite libraries (npm packages, CDN)
      2. Common web-safe or open-source art packs
      3. Web-searched and sourced sprite/icon assets (use web search to find them)
      4. Generated placeholder sprites/portraits (canvas-drawn, SVG, emoji-based)
      5. Simple geometric fallback tiles (LAST RESORT, not the primary path)

      Visual polish is a gate criterion. Implementers may use easily installable resources
      provided the dependency/setup burden stays low and the result remains coherent.
      Raw ASCII/text-only UI fails this gate.
    </gate>
  </gate-criteria>

  <!-- ============================================================ -->
  <!-- SCORED CRITERIA: Each scored 0-1, averaged for coverage ratio -->
  <!-- ============================================================ -->
  <success-criteria>
    <!-- Combat -->
    <criterion>Turn-based combat with Fight/Spells/Bag/Run actions, visible HP bars for both player and enemy, damage numbers shown, XP/crystal rewards on win</criterion>
    <criterion>At least 3 distinct enemy types with different stats, encountered in combat rooms</criterion>

    <!-- Dialogue -->
    <criterion>NPC dialogue with portrait/representation, dialogue text, and branching choice options that affect gameplay (give items, teach spells, reveal info)</criterion>

    <!-- Navigation and exploration -->
    <criterion>Room navigation showing current location, available exits, and room type — player chooses where to go via buttons/choices</criterion>
    <criterion>Dungeon has at least 3 rooms with different types (combat, dialogue, treasure, rest, forge)</criterion>
    <criterion>Fog of war or discovery — rooms are revealed as player explores</criterion>

    <!-- HUD and menus -->
    <criterion>Persistent HUD showing: player name, HP bar, mana bar, current floor, dungeon tick or turn count</criterion>
    <criterion>At least two overlay menus accessible during gameplay (Map, Bag, Stats, Spellbook — pick two minimum)</criterion>

    <!-- Systems -->
    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>
    <criterion>Content pack architecture: game data loaded from JSON files, not hardcoded in source</criterion>
    <criterion>Game state persists across page refresh (localStorage save/load or auto-save)</criterion>
    <criterion>Player can level up or gain power through gameplay progression (XP, stat increases, new abilities)</criterion>
  </success-criteria>

  <vertical-slice>
    The eval prioritizes a PLAYABLE DEMO over feature completeness. Build the UI and
    game loop first, then add depth. The build order should be:
    1. Project scaffold + title screen that renders
    2. Room navigation with styled UI (not ASCII)
    3. Combat encounter with visual HP bars
    4. Rune forge with basic spell crafting
    5. Dialogue with NPC representation
    6. HUD + menus
    7. Content packs + save/load
    8. Polish pass

    Spell crafting must be reachable within the playable loop, though not necessarily
    in the first two rooms if that would overconstrain pacing.
  </vertical-slice>

  <non-goals>
    <item>Tile-based movement or 2D grid walking — navigation is choice-driven via room graph</item>
    <item>Similarity/vector/distance-based content selection — all content is authored and static</item>
    <item>Full 50 titles + 50 archetypes content — minimum viable for demo</item>
    <item>Complex asset pipelines or custom art tools — use easily sourced assets</item>
    <item>Multiplayer or networking</item>
  </non-goals>

  <source-docs>
    <doc path="source-GAMEPLAY-DESIGN.xml" role="Trimmed gameplay design (vertical slice focus)" />
    <doc path="source-STAT-AND-BEHAVIOUR-TAXONOMY.md" role="Canonical stat names, groupings, and engine mappings" />
  </source-docs>
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

## Hosted demo and source (portfolio site)

A **production build** of the game can be copied into the **custom_portfolio** repo at `apps/portfolio/public/evals/escape-the-dungeon/` so it is served at **`/evals/escape-the-dungeon/`** (playable in the browser). **Game source** lives in this repo under **`evals/escape-the-dungeon/game/`** (Vite + TypeScript + Kaplay). Traces and scores remain under `evals/escape-the-dungeon/vN/`.

## Source material

- `source-GAMEPLAY-DESIGN.xml` — full gameplay design (500+ lines of XML)
- `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` — canonical stat names and engine mappings
- `template/.planning/REQUIREMENTS.xml` — structured requirements derived from source docs

## Human review

After the eval agent completes, a human opens the build output (`gad eval open escape-the-dungeon`)
and scores it 0.0-1.0 via `gad eval review`. The rubric:

| Score | Meaning |
|-------|---------|
| 0.0 | Blank screen, nothing renders |
| 0.1-0.3 | Something renders but not playable (menus don't work, can't start game) |
| 0.4-0.6 | Playable vertical slice — can start game, navigate, have one interaction |
| 0.7-0.8 | Multiple interactions work, UI is functional, core loop is playable |
| 0.9-1.0 | Polished, all major systems present and working, feels like a real game |

**Gate:** If the build output shows a blank screen, `requirement_coverage` is overridden to 0
regardless of what the automated trace says. Code that doesn't render has zero coverage.

## v5 finding

v5 scored auto_composite 0.955 but human_review 0.0 (blank screen). The agent built systems
code but no visible UI. Requirements updated to mandate UI-first build order and a playable
vertical slice as the primary success criterion.


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
  <!-- Agent: plan your phases here based on REQUIREMENTS.xml. -->
  <!-- Priority: UI-first, playable vertical slice before deep systems. -->
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
  <next-action>Read REQUIREMENTS.xml and source docs. Plan phases in ROADMAP.xml — UI-first, vertical slice priority. Create tasks in TASK-REGISTRY.xml. Then implement phase by phase following AGENTS.md.</next-action>
  <last-updated>2026-04-08</last-updated>
</state>
```

## Source documents

### source-GAMEPLAY-DESIGN.xml

<?xml version="1.0" encoding="UTF-8"?>
<!--
  Escape the Dungeon: gameplay design (trimmed for vertical slice eval).
  Full design is 640 lines. This version focuses on what's needed for a playable demo.
-->
<gameplay-design>
  <identity>
    <one-liner>Roguelike dungeon crawl where you negotiate as much as you fight.</one-liner>
    <reference>Pokemon is a reference for encounter system, types, and sprites.</reference>
    <pacing>Target ~1 dungeon floor cleared per game hour. Main driver: loot.</pacing>
  </identity>

  <player-loop>
    <primary-driver>Loot.</primary-driver>
    <success-criteria>In 5 minutes: "I cared about one choice." Avoid: unclear what to do next.</success-criteria>
  </player-loop>

  <!-- NAVIGATION: How the player moves through the dungeon -->
  <navigation>
    <model>Graph of rooms. Each room has: id, name, description, type, exits (direction → target room id). No tile-based movement — player chooses exits from buttons/choices.</model>
    <floor-map>Show current floor as a simple list or grid of rooms. Player sees: current room highlighted, available exits as buttons, room types (combat, dialogue, treasure, rest, boss).</floor-map>
    <fog>Rooms start undiscovered. Adjacent rooms become visible when you enter a neighboring room. Boss room is always visible.</fog>
    <simplified-navigation>For the vertical slice, navigation can be simplified to button choices: "Go North (Combat Room)", "Go East (Treasure Room)". A full graphical map is NOT required — functional room-to-room movement is.</simplified-navigation>
  </navigation>

  <!-- DUNGEON STRUCTURE -->
  <dungeon>
    <floors>Multiple dungeon floors. Each floor has rooms connected by exits. Boss guards the exit to the next floor.</floors>
    <tick-system>Dungeon tick advances when player enters a room. Boss spawns enemies every 3 ticks from adjacent rooms.</tick-system>
    <room-types>
      <type>combat — enemy encounter</type>
      <type>dialogue — NPC conversation</type>
      <type>treasure — loot chest</type>
      <type>rest — heal HP/mana</type>
      <type>forge — craft/evolve spells</type>
      <type>boss — floor boss, guards exit</type>
    </room-types>
  </dungeon>

  <!-- COMBAT: Turn-based encounters -->
  <combat>
    <flow>Turn-based. Player acts, then enemy acts. Repeat until one side is defeated or player flees.</flow>
    <actions>
      <action>Fight — basic attack using Might stat vs enemy Defense</action>
      <action>Spells — cast a prepared spell (costs mana)</action>
      <action>Bag — use an item (potion, scroll)</action>
      <action>Run — attempt to flee (Agility check)</action>
    </actions>
    <stats>
      <stat>HP — health points, 0 = defeat</stat>
      <stat>Mana — spell resource, spent on casting</stat>
      <stat>Might — physical attack power</stat>
      <stat>Agility — speed, flee chance</stat>
      <stat>Defense — damage reduction</stat>
    </stats>
    <rewards>Win = XP + mana crystals. Lose = game over (or ret
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

3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID — one commit per task, not per phase

4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture

4b. Capture decisions AS YOU MAKE THEM — if you chose between alternatives (library, pattern, data model), write a <decision> to DECISIONS.xml before committing that task. Aim for 1-2 per phase minimum.

5. After EACH phase completes: write/append to .planning/VERIFICATION.md (build result, task count, state check), commit with "verify: phase X verified"

6. When complete: all phases done, build passes, planning docs current

7. FINAL STEP: produce a production build (dist/ directory) and commit it. The build artifact is showcased on the docs site. No dist = eval incomplete.


## Logging


Set GAD_LOG_DIR to your eval run directory before running gad commands.

All gad CLI calls and tool uses will be logged to JSONL files for eval tracing.

```sh
export GAD_LOG_DIR=<eval-run-dir>/.gad-log
```