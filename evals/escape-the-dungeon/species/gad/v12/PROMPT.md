# Eval: escape-the-dungeon v12


**Mode:** greenfield | **Workflow:** gad



You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

# Agent guide — Escape the Dungeon (eval project)

**You are inside a GAD eval.** Follow this loop exactly. Your work is being traced.

## Project layout (MANDATORY)

Create the game under `game/` in the worktree root. The template provides starter
planning files in `<worktree-root>/.planning/` but you MUST copy them into `game/.planning/`
at the start so ALL your workflow artifacts live alongside the game.

```
game/
├── .planning/            ← ALL workflow artifacts go here
│   ├── REQUIREMENTS.xml  ← copied from template
│   ├── ROADMAP.xml       ← you plan phases here
│   ├── TASK-REGISTRY.xml ← you track tasks here
│   ├── STATE.xml         ← current phase + next-action
│   ├── DECISIONS.xml     ← architectural decisions
│   ├── VERIFICATION.md   ← phase verification results
│   ├── ARCHITECTURE.md   ← final system overview
│   └── CONVENTIONS.md    ← patterns (after first code phase)
├── src/                  ← source code only
├── public/               ← assets
└── package.json, tsconfig.json, etc.
```

Never put workflow/tracking/notes/decision files at the project root or mixed with source
code — they all live under `game/.planning/`.

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
  Requirements version history:
    v1 (2026-04-06): 12 systems-focused criteria, no gates
    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate
    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate
    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,
                     floor progression with boss gates, forge integrated with encounter design,
                     starter abilities explicitly insufficient, Traits UI label
    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user
                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice
                     (rule-based UO-style preferred), entity-trait action policies (enemies
                     AND NPCs), real-time game-time, affinity reward loop, central visual
                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,
                     event-driven rendering, save checkpoints, merchants, NPC dialogue,
                     inventory/equipment, character sheet + skill tree, loadout slots.
                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.
-->
<requirements version="v5" updated="2026-04-09">
  <goal>
    Build a playable roguelike dungeon crawler "Escape the Dungeon" where players must
    exercise INGENUITY through spell crafting and adaptation to progress. This is not a
    features checklist — it is a problem-solving loop disguised as a dungeon crawler.
    Every mechanical system must create friction that rewards creative player choice.
  </goal>

  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>

  <core-principle>
    **Baseline starter abilities must NOT be sufficient to comfortably complete a full
    floor without adaptation or enhancement.** If a player can brute-force progression
    using only what they start with, the design has failed. Encounters must demand
    spell crafting, skill use, resource management, or build specialization.
  </core-principle>

  <!-- ============================================================ -->
  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->
  <!-- ============================================================ -->
  <gate-criteria>

    <gate id="G1" name="game-loop">
      The complete game loop must work without softlock. A test run must walk through:
      1. Title screen renders and "New Game" starts a run
      2. Player enters first room with visible navigation options
      3. Player navigates to a second room (scene transition succeeds)
      4. Player encounters combat OR dialogue and resolves it
      5. After resolution, player returns to room navigation state
      6. Player continues into at least one additional room without softlock or dead end
      Minimum 3 total room transitions in a passing run.
    </gate>

    <gate id="G2" name="forge-with-ingenuity-payoff">
      The game must include a functional spell-crafting system AND at least one encounter
      per floor where the crafted/adapted spell provides a meaningful advantage.

      Crafting requirements:
      - Player can access a forge / spell-craft interface during gameplay
      - Player selects at least 2 crafting inputs (runes or components)
      - System produces a new, usable spell from the combination
      - Crafted spell can be equipped and used in encounter flow
      - Minimum 3-5 runes/components, 3+ valid combinations

      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):
      - At least one encounter per floor must significantly favor or require a crafted/
        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes
        spell repetition, enemy that only yields to DoT or burst, etc.
      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.
      - Player must intentionally CRAFT to succeed.
    </gate>

    <gate id="G3" name="ui-quality">
      The game must present a fully intentional UI. Required:
      - Readable, visually structured layout with spacing and hierarchy
      - Room-type icons or sprite representations
      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder
      - Themed visual differentiation across room types (color, background, or panel treatment)
      - Styled interactive controls (buttons with visible affordance)
      - HP/mana/resources as visual bars, not only numeric dumps
      - Color-coded statuses / spell types / factions

      Acceptable asset sourcing (in order of preference):
      1. Lightweight installable icon/sprite libraries (npm packages, CDN)
      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)
      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)
      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score

      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate
      failure even if asset sourcing was attempted.
    </gate>

    <gate id="G4" name="pressure-mechanics">
      The game must include at least TWO systems that constrain player behavior such that
      crafting or adapting spells provides a meaningful advantage or is required for success.

      Pick at least two from these categories:
      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,
         cannot spam indefinitely
      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,
         shields requiring specific effects
      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate
         default play, rooms with mechanical constraints
      D. **Build pressure** — player cannot master everything, affinity pushes specialization,
         loadout limits force trade-offs

      At least one pressure mechanic must interact with the forge so crafted spells are
      demonstrably more effective than default spells in affected encounters.
    </gate>

  </gate-criteria>

  <!-- ============================================================ -->
  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->
  <!-- ============================================================ -->
  <dungeon-structure>
    <authored-only>
      All content is authored. No procedural level generation. Light randomness in encounter
      tables or loot is acceptable; structural layout must be hand-designed.
    </authored-only>

    <hierarchy>
      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that
      gates progression to the next floor. Player clears a floor by defeating the boss,
      which unlocks the next floor.
    </hierarchy>

    <room-types>
      <type name="Combat">Standard enemy encounter, authored enemy composition.</type>
      <type name="Elite">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>
      <type name="Forge">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>
      <type name="Rest">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>
      <type name="Event">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>
    </room-types>

    <floor-mechanical-constraint>
      Each floor MUST introduce at least one mechanical constraint or enemy behavior that
      cannot be brute-forced with the player's current default abilities. Examples:
      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects
      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks
      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills
      This constraint is discovered through gameplay, not explained in a tutorial.
    </floor-mechanical-constraint>

    <respawn-and-grinding>
      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is
      authored, not every entry). Player can grind for XP, crystals, and rune affinity
      before attempting bosses. Grinding should be slower than forge training to create
      choice pressure.
    </respawn-and-grinding>
  </dungeon-structure>

  <!-- ============================================================ -->
  <!-- FORGE SYSTEM (now integrated with encounter design)          -->
  <!-- ============================================================ -->
  <forge-system>
    <required>
      - Forge interface accessible at Forge rooms
      - 3-5 runes or crafting components
      - 3+ valid combinations producing distinct spell effects
      - Affinity tracking per rune/spell family, increases with use
      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)
      - At least one encounter per floor requires or strongly favors a crafted/adapted spell
    </required>
    <strongly-recommended>
      - Visible affinity level (UI shows current levels)
      - Affinity thresholds unlock stronger spell variants
      - Authored or player-authored spell customization (player can name their spells)
    </strongly-recommended>
    <deferred-to-v5>
      - Cross-affinity decay when runes are neglected
      - Deep evolution trees
      - Multi-stage spell mutations
    </deferred-to-v5>
  </forge-system>

  <!-- ============================================================ -->
  <!-- SKILLS (scored, not gated)                                    -->
  <!-- ============================================================ -->
  <skills-system>
    <required>
      Combat must support at least one non-spell action category (basic attack, skill, or similar).
      The combat model should NOT be single-lane "spell or nothing".
    </required>
    <scored>
      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal
      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).
    </scored>
  </skills-system>

  <!-- ============================================================ -->
  <!-- ASSET SOURCING (first attempt real assets)                   -->
  <!-- ============================================================ -->
  <asset-sourcing>
    <workflow>
      Agents must attempt asset sourcing first via the find-sprites skill or equivalent
      web-search workflow. Sourced assets should be lightweight, installable, and legally
      usable (open-license, public domain, or generated).
    </workflow>
    <preference-order>
      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)
      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)
      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)
      4. Geometric fallback tiles — LAST RESORT, counts against UI quality
    </preference-order>
    <fallback-policy>
      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely
      fails (404s, no suitable assets, integration cost disproportionate). Fallback must
      still be visually coherent. Using fallback when real assets were reachable is a
      gate violation.
    </fallback-policy>
  </asset-sourcing>

  <!-- ============================================================ -->
  <!-- TERMINOLOGY                                                   -->
  <!-- ============================================================ -->
  <terminology>
    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>
    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>
    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>
  </terminology>

  <!-- ============================================================ -->
  <!-- SCORED CRITERIA                                               -->
  <!-- ============================================================ -->
  <scored-criteria>
    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>
    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>
    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>
    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>
    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>
    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>
    <criterion>Game state persists across page refresh (localStorage)</criterion>
    <criterion>Player can level up or gain power through gameplay progression</criterion>
    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>
    <criterion>"Traits" label used in UI where narrative stats appear</criterion>
    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>
    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>
  </scored-criteria>

  <!-- ============================================================ -->
  <!-- INGENUITY / ADAPTATION SCORING                                -->
  <!-- ============================================================ -->
  <ingenuity-scoring>
    <dimension>ingenuity_score</dimension>
    <measures>
      Whether the player needed to change strategy, whether crafted spells were meaningfully
      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.
    </measures>
    <signals>
      - Number of crafted spells actually used in a test run
      - Diversity of spell usage (no single spell dominates)
      - Can the starter spell alone clear every floor? (this should be NO)
      - Does at least one encounter REQUIRE crafted spell usage to succeed?
      - Did the test player adapt their build across floors?
    </signals>
    <scoring-notes>
      This is measured via human review during playtesting. The reviewer asks: "Did I feel
      like I needed to craft to make progress, or could I spam the default spell?"
    </scoring-notes>
  </ingenuity-scoring>

  <non-goals>
    <item>Procedural generation — authored content only</item>
    <item>Full rune affinity decay — deferred to v5</item>
    <item>Multi-stage deep evolution trees — deferred to v5</item>
    <item>Tile-based movement or 2D grid walking</item>
    <item>Multiplayer or networking</item>
    <item>Complex asset pipelines or custom art tools</item>
  </non-goals>

  <source-docs>
    <doc path="source-GAMEPLAY-DESIGN.xml" role="Trimmed gameplay design (vertical slice focus)" />
    <doc path="source-STAT-AND-BEHAVIOUR-TAXONOMY.md" role="Canonical stat names, groupings, engine mappings" />
  </source-docs>

  <evaluation-notes>
    Human reviewer rubric for ingenuity:
    - 0.0: Could spam starter abilities to clear everything, no crafting needed
    - 0.3: Had to use forge once, but mostly spammed
    - 0.6: Had to craft 2-3 spells and switch strategies per floor
    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle
  </evaluation-notes>

  <!-- ============================================================ -->
  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->
  <!--                                                              -->
  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->
  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->
  <!-- v10 (api-interrupted). Source markdown:                      -->
  <!-- evals/_v5-requirements-addendum.md                           -->
  <!--                                                              -->
  <!-- Everything in v4 above still applies. v5 adds on top.        -->
  <!-- ============================================================ -->
  <addendum version="v5" updated="2026-04-09">

    <requirement id="R-v5.01" amends="G2" title="Training via encounter, not menu">
      Affinity must increase as a side effect of casting spells in encounters, not as a
      direct menu action. Remove any "select affinity → train" menu that picks the trained
      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat
      room type) whose only purpose is letting the player cast without risk so affinity
      rises through use. Any room with combat must produce affinity gain for the elements/
      runes the cast spell used. The forge becomes a place to forge and combine, not to
      train. Rationale: the casting of spells must be what increases rune affinity; direct
      training menus turn a discovery loop into a shopping list.
    </requirement>

    <requirement id="R-v5.02" title="Rune discovery as a gameplay loop">
      Not all runes are listed or available at game start. Runes must be DISCOVERED across
      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are
      found as loot drops from combat/elite encounters, hidden in event rooms, sold by
      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly
      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least
      one rune per floor must be gated behind a non-combat interaction.
    </requirement>

    <requirement id="R-v5.03" title="Merchants with buy/sell/trade">
      The dungeon must contain at least one merchant encounter per floor. Merchant room
      type. Inventory of runes, potions, and items with gold cost. Three operations: buy
      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a
      relative value rule). Gold or an equivalent currency becomes a tracked resource.
    </requirement>

    <requirement id="R-v5.04" title="NPC dialogue with branching outcomes">
      Authored NPCs must appear with dialogue options that trigger items, events, or
      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.
      Dialogue choices must cause persistent game state changes: item gain, rune unlock,
      enemy spawn, merchant discount, quest flag.
    </requirement>

    <requirement id="R-v5.05" title="Inventory/bag with grid and equippable items">
      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have
      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,
      focus, etc.). Equipment slots must exist on a character sheet with at least:
      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or
      spell outputs in a measurable way. Items must drop from combat, events, and
      merchants.
    </requirement>

    <requirement id="R-v5.06" title="Visible character sheet with combat/physical skills and a skill tree">
      Player must be able to inspect their character at any time. Panel showing: HP, mana,
      affinities, physical/combat stats, resistances, equipped items, known spells, known
      physical skills. Skill tree or equivalent progression graph for physical/combat
      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to
      distinguish from spells.
    </requirement>

    <requirement id="R-v5.07" title="Spell slots and skill slots (loadout constraint)">
      When the player has many spells/skills, they must choose which to equip. Fixed-size
      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size
      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed
      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic
      satisfying G4.
    </requirement>

    <!-- R-v5.08 REMOVED — v4 progression requirements were sufficient. -->

    <requirement id="R-v5.09" amends="G1" title="Session persistence">
      The game must support resumable sessions. On room-clear or floor-clear, the
      game checkpoints the player's state. If the player closes the browser or the
      session ends, re-opening the game presents a Continue option that restores the
      most recent checkpoint. New Game starts fresh. Both paths must work without error.
    </requirement>

    <requirement id="R-v5.10" amends="G3" title="Transient UI feedback">
      UI feedback elements (toasts, status messages, combat results) must be transient
      and session-scoped. Each element auto-dismisses after a brief display period
      (3-5 seconds) or provides an explicit dismiss control. Starting a new session
      must present a clean UI with no carried-over feedback from a previous session.
    </requirement>

    <requirement id="R-v5.11" amends="room-types" title="Rest rooms must offer rest">
      Any room typed Rest (including the rune forge rest variant) must expose a Rest
      action that restores HP/mana and allows loadout changes. Forge rooms may combine
      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room
      claims Rest as a room type.
    </requirement>

    <requirement id="R-v5.12" amends="G3" title="Navigation and map usability">
      Map/navigation UI must be more than a linear list. Map view must show at minimum a
      2D graph layout of discovered rooms with current position, cleared/uncleared state,
      and available exits. Navigation from the map must be one click, not a multi-step
      menu. See R-v5.17 for the stronger form.
    </requirement>

    <requirement id="R-v5.13" amends="G1 G4" title="Auto-resolve combat with tactical loadout (Unicorn Overlord style)">
      Combat resolves automatically based on the player's pre-set loadout, equipped
      spells/skills, and tactical rules. The player does NOT click-attack individual
      enemies during combat. Instead:

      1. Before an encounter, the player configures: equipped spells, equipped physical
         skills (per loadout slots from R-v5.07), formation/positioning of party members
         (if applicable), and action-policy rules (e.g. "use heal when HP below 30%",
         "prioritize targets weak to equipped element").
      2. Combat plays out in real-time with a visible combat log showing each action,
         its effect, and why it was chosen (which rule triggered).
      3. The player can PAUSE at any time to adjust loadout, swap spells, or change
         action-policy rules. The fight resumes with the new configuration.
      4. Resolution depends on the loadout quality, spell/skill choices, and how well
         the action policies match the enemy composition — this is where the forge and
         rune crafting systems pay off.

      This model rewards preparation and build-crafting over reflexes. The ingenuity
      requirement (G2) is satisfied by encounters where the default loadout fails and
      the player must pause, rethink, and adapt their tactical rules.
    </requirement>

    <requirement id="R-v5.14" title="Trait-driven behavior for all entities">
      Every entity with agency (enemies, NPCs, the player character) has traits that
      drive their behavior. Traits are NOT static labels — they shift based on:

      - Dialogue choices the player makes (choosing aggressive responses shifts the
        player toward "aggressive" trait, which changes available dialogue options
        with NPCs who react to that trait)
      - Moral interactions (sparing vs defeating enemies, helping vs ignoring NPCs,
        stealing vs buying from merchants)
      - Combat actions (repeatedly using fire spells shifts affinity toward fire,
        which may change how fire-resistant enemies react)

      Enemy behavior in auto-resolve combat is governed by their traits: an aggressive
      enemy prioritizes attack, a territorial enemy holds position, a cowardly enemy
      flees at low HP. NPC dialogue options expand or contract based on trait alignment
      between the player and the NPC. Traits have visible NUMERIC values on the
      character sheet (e.g. aggression: 0.7, compassion: 0.3, arcane affinity: 0.8).
      When a trait shifts, the numeric change is shown inline (combat log or a brief
      HUD notification like "+0.1 aggression").
    </requirement>

    <requirement id="R-v5.15" title="Real-time game clock">
      The dungeon has an in-game clock that progresses in real time (suggested ratio:
      1 real hour = 1 in-game day). The clock can influence gameplay: encounter
      composition may shift by time of day, merchant stock may rotate, certain NPC
      events may be time-gated. Day/night UI tinting is a SOFT bonus (not a gate).
      The clock is purely flavor and pacing — it does NOT add turn-based tick
      mechanics or per-tick processing. All rendering remains event-driven per
      R-v5.21.
    </requirement>

    <requirement id="R-v5.16" title="Affinity reward loop">
      Boosting a rune's affinity must produce a visible, valuable reward — not just a
      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new
      rune variant unlocked, existing spells using that rune gain a visual effect tier,
      new spell combinations become craftable, access to an affinity-gated event or NPC.
      At least one affinity reward must be visible in the forge UI (e.g. an affinity
      progress bar with named milestones).
    </requirement>

    <requirement id="R-v5.17" amends="G3 R-v5.12" title="Central visual navigation map with player location">
      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,
      visual map. Accessible from a single button/keystroke at any time in exploration
      mode. Shows the player token on its current room, room type icons, discovered vs
      undiscovered rooms, cleared vs active rooms, and visible exit connections between
      rooms. Clicking an adjacent room must move the player there in one action.
      Preferred layout: 2D grid or spatial floor map.
    </requirement>

    <requirement id="R-v5.18" title="Visual player vs enemy identity in encounters">
      Encounter rendering must make it obvious which visual element is the player and
      which is the enemy. Distinct portrait, positioning, or color treatment. Reference
      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player
      cannot visually distinguish themselves from the first enemy without reading text
      labels.
    </requirement>

    <requirement id="R-v5.19" title="Spells as craftable ingredients + procedural-but-semantic naming">
      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an
      ingredient consumes or copies from the existing spell (design choice explicit).
      Combining two spells or a spell + rune produces an evolved spell with procedurally
      generated but semantically meaningful naming. Naming scheme must be consistent but
      varied — similar combinations produce similar names, slight differences produce
      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun
      keyed to added element/spell. "Fireball" + Ice rune → "Frostfall Ember". Two
      Frostfall Embers fused → "Glacial Ember" (same family, progressed). This requirement
      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/
      merge system is an explicit narrative analogue for the agent's skill-authoring/merge
      loop.
    </requirement>

    <requirement id="R-v5.20" title="Unique ingredients per spell">
      Each spell recipe requires unique ingredients — the same rune cannot be used
      twice in a single spell's ingredient list. Selecting a rune already in the
      current recipe must deselect it or be rejected. The same rune CAN appear
      across different spells in the spellbook. Affinity gain is calculated per
      unique rune slot consumed.
    </requirement>

    <requirement id="R-v5.21" title="Event-driven rendering (remove per-tick redraws)">
      All UI updates must be event-driven, not per-tick. No redraw loops firing at a
      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy
      redraws on button clicks, observed across ALL round-4 builds. This is a
      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on
      state change, requestAnimationFrame scheduling only when animation is active.
    </requirement>

    <gate-impact-summary>
      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,
      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),
      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and
      introduce new scored dimensions for inventory_and_equipment_present and
      npc_dialogue_present rather than new gates — a run missing those does not get
      gate-zeroed but takes a meaningful scored hit.
    </gate-impact-summary>

    <deferred-to-v6>
      <item>Deep evolution trees (multi-stage mutations).</item>
      <item>Rune affinity decay when unused.</item>
      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>
    </deferred-to-v6>

  </addendum>
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