/**
 * Auto-generated from evals/<project>/<version>/TRACE.json files.
 * DO NOT EDIT BY HAND — run `npm run prebuild` to regenerate.
 */

export type Workflow = "gad" | "bare" | "emergent";

export type EvalScores = {
  requirement_coverage?: number | null;
  planning_quality?: number | null;
  per_task_discipline?: number | null;
  skill_accuracy?: number | null;
  time_efficiency?: number | null;
  human_review?: number | null;
  workflow_emergence?: number | null;
  implementation_quality?: number | null;
  iteration_evidence?: number | null;
  composite?: number | null;
} & Record<string, number | null | undefined>;

export interface EvalRunRecord {
  project: string;
  version: string;
  workflow: Workflow;
  requirementsVersion: string;
  date: string | null;
  gadVersion: string | null;
  traceSchemaVersion: number;
  frameworkVersion: string | null;
  frameworkCommit: string | null;
  frameworkBranch: string | null;
  frameworkCommitTs: string | null;
  frameworkStamp: string | null;
  traceEvents: Array<Record<string, unknown>> | null;
  evalType: string;
  contextMode: string | null;
  timing:
    | ({
        duration_minutes?: number | null;
        phases_completed?: number | null;
        tasks_completed?: number | null;
      } & Record<string, unknown>)
    | null;
  tokenUsage:
    | ({
        total_tokens?: number | null;
        tool_uses?: number | null;
        note?: string | null;
      } & Record<string, unknown>)
    | null;
  gitAnalysis:
    | ({
        total_commits?: number | null;
        task_id_commits?: number | null;
        batch_commits?: number | null;
        per_task_discipline?: number | null;
      } & Record<string, unknown>)
    | null;
  requirementCoverage:
    | ({
        total_criteria?: number | null;
        gate_failed?: boolean | null;
        gate_notes?: string | null;
        fully_met?: number | null;
        partially_met?: number | null;
        not_met?: number | null;
        coverage_ratio?: number | null;
      } & Record<string, unknown>)
    | null;
  workflowEmergence:
    | ({
        created_task_lists?: boolean | null;
        created_state_tracking?: boolean | null;
        created_architecture_docs?: boolean | null;
        created_reusable_skills?: boolean | null;
        emergence_score?: number | null;
      } & Record<string, unknown>)
    | null;
  planningQuality:
    | ({
        phases_planned?: number | null;
        tasks_planned?: number | null;
        tasks_completed?: number | null;
        decisions_captured?: number | null;
      } & Record<string, unknown>)
    | null;
  derived?: {
    divergence_score: number | null;
    plan_adherence_delta: number | null;
    produced_artifact_density: number | null;
    tool_use_mix: Record<string, number> | null;
    skill_to_tool_ratio: number | null;
    subagent_utilization: number | null;
    total_commits: number | null;
    commit_discipline: number | null;
  };
  scores: EvalScores;
  humanReview:
    | ({
        score?: number | null;
        notes?: string | null;
        reviewed_by?: string | null;
        reviewed_at?: string | null;
      } & Record<string, unknown>)
    | null;
  humanReviewNormalized: {
    rubric_version: string;
    dimensions: Record<string, { score: number | null; notes: string | null }>;
    aggregate_score: number | null;
    notes: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    is_legacy: boolean;
    is_empty: boolean;
  };
  requirementsDoc: {
    filename: string;
    path: string;
    content: string;
    format: 'xml' | 'md';
  } | null;
  topSkill: {
    filename: string;
    content: string | null;
    bytes: number;
    total_skills: number;
  } | null;
  skillAccuracyBreakdown:
    | {
        expected_triggers: Array<{
          skill: string;
          when?: string;
          triggered: boolean;
          note?: string;
        } & Record<string, unknown>>;
        accuracy: number | null;
      }
    | null;
}

export interface EvalTemplateAsset {
  project: string;
  zipPath: string;
  bytes: number;
}

export interface PlanningZipAsset {
  project: string;
  zipPath: string;
  bytes: number;
  files: number;
}

export interface RoundSummary {
  round: string;
  title: string;
  body: string;
}

export interface EvalProjectMeta {
  id: string;
  name: string;
  description: string | null;
  evalMode: string | null;
  workflow: string | null;
  baseline: string | { project?: string; version?: string; source?: string } | null;
  constraints: Record<string, unknown> | null;
  scoringWeights: Record<string, number> | null;
  humanReviewRubric: {
    version: string;
    dimensions: Array<{
      key: string;
      label: string;
      weight: number;
      description: string;
    }>;
  } | null;
}

export interface ProducedArtifacts {
  skillFiles: Array<{ name: string; bytes: number }>;
  agentFiles: Array<{ name: string; bytes: number }>;
  planningFiles: Array<{ name: string; bytes: number }>;
  workflowNotes: Array<{ name: string; bytes: number }>;
}

export const EVAL_RUNS: EvalRunRecord[] = [
  {
    "project": "escape-the-dungeon",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-06",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-06T21:39:38.637Z",
      "ended": "2026-04-06T21:39:39.663Z",
      "duration_minutes": 0,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "cli_efficiency": 0,
      "skill_accuracy": null,
      "planning_quality": null,
      "time_efficiency": 1,
      "composite": null
    },
    "humanReview": {
      "score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": null,
          "notes": null
        }
      },
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [],
      "accuracy": null
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": null,
      "commit_discipline": null
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v10",
    "workflow": "gad",
    "requirementsVersion": "v4",
    "date": "2026-04-09",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 4,
    "frameworkVersion": "1.32.0",
    "frameworkCommit": "459dc36",
    "frameworkBranch": "main",
    "frameworkCommitTs": null,
    "frameworkStamp": "v1.32.0+459dc36",
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-09T05:30:00.000Z",
      "ended": "2026-04-09T05:39:00.000Z",
      "duration_minutes": 9,
      "phases_completed": 2,
      "tasks_completed": 6,
      "api_interrupted": true,
      "interruption_note": "Anthropic API returned 529 overloaded_error at tool_uses=55. Not a rate limit (full budget available), transient server overload. Previous attempt (not preserved) crashed at tool_uses=18 with the same error."
    },
    "tokenUsage": {
      "total_tokens": 1216,
      "tool_uses": 55,
      "note": "API 529 interrupted — more tool uses than Bare v5 (45) or Emergent v4 (45) but NO playable game produced. The 55 tool uses went to planning + data authoring, not scene implementation."
    },
    "gitAnalysis": {
      "total_commits": 0,
      "task_id_commits": 0,
      "batch_commits": 0,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "G1 NOT MET — no game loop. Dist is scaffold-only title 'ESCAPE THE DUNGEON v10 — scaffold booted' with no navigation, combat, or forge wired. router.ts is an 11-line stub. G2 NOT MET — runes and spells data authored (221 lines of runes.ts) but no forge UI. G3 PARTIAL — scaffold title has iconify-icon + styled h1 but that is the only rendered surface. G4 NOT MET — pressure mechanics not implemented beyond data declarations.",
      "fully_met": 0,
      "partially_met": 2,
      "not_met": 10,
      "coverage_ratio": 0.083
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": false,
      "emergence_score": 0.75
    },
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 20,
      "tasks_completed": 6,
      "tasks_blocked": 14,
      "decisions_captured": 0,
      "state_updates": 2,
      "state_stale_count": 0,
      "note": "Full XML planning suite: ROADMAP with 7 phases (scaffold, data, title+HUD, room-navigation, combat, forge-and-runes, pressure-encounters), TASK-REGISTRY with ~20 tasks, STATE current at phase 02 task 02-01, DECISIONS scaffolded. Phase 01 + Phase 02 complete with 875 lines of TypeScript (types 137, state 72, enemies 160, floors 224, runes 221, events 43, main 7 stub, router 11 stub). Phases 03-07 NOT STARTED — scenes for title, room, combat, forge all unimplemented at interruption."
    },
    "scores": {
      "requirement_coverage": 0.083,
      "planning_quality": 0.9,
      "per_task_discipline": 0,
      "skill_accuracy": null,
      "time_efficiency": 0.7,
      "human_review": 0.02,
      "composite": null
    },
    "humanReview": {
      "rubric_version": "v1",
      "dimensions": {
        "playability": {
          "score": 0,
          "notes": null
        },
        "ui_polish": {
          "score": 0.1,
          "notes": null
        },
        "mechanics_implementation": {
          "score": 0,
          "notes": null
        },
        "ingenuity_requirement_met": {
          "score": 0,
          "notes": null
        },
        "stability": {
          "score": 0,
          "notes": null
        }
      },
      "aggregate_score": 0.02,
      "notes": "GAD v10 — api-interrupted per gad-64 (HTTP 529 pattern crashed the planning phase before scene implementation). Main title screen felt novel and visually cool which is where the 0.10 on UI polish comes from, but everything beyond it is absent: no game loop, no mechanics, no ingenuity payoff, no stable play. Preserved as a data point, excluded from cross-round quality comparisons (gad-63 + gad-64). User playtest 2026-04-09.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T18:56:35.493Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "v1",
      "dimensions": {
        "playability": {
          "score": 0,
          "notes": null
        },
        "ui_polish": {
          "score": 0.1,
          "notes": null
        },
        "mechanics_implementation": {
          "score": 0,
          "notes": null
        },
        "ingenuity_requirement_met": {
          "score": 0,
          "notes": null
        },
        "stability": {
          "score": 0,
          "notes": null
        }
      },
      "aggregate_score": 0.02,
      "notes": "GAD v10 — api-interrupted per gad-64 (HTTP 529 pattern crashed the planning phase before scene implementation). Main title screen felt novel and visually cool which is where the 0.10 on UI polish comes from, but everything beyond it is absent: no game loop, no mechanics, no ingenuity payoff, no stable play. Preserved as a data point, excluded from cross-round quality comparisons (gad-63 + gad-64). User playtest 2026-04-09.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T18:56:35.493Z",
      "is_legacy": false,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 14,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 0,
      "commit_discipline": null
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v2",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-06",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-06T21:30:50.000Z",
      "ended": "2026-04-07T00:25:05.000Z",
      "duration_minutes": 174,
      "phases_completed": 0,
      "tasks_completed": 34
    },
    "tokenUsage": null,
    "gitAnalysis": {
      "total_commits": 4,
      "task_id_commits": 1,
      "batch_commits": 1,
      "source_files_created": 18,
      "state_updates": 0,
      "decisions_added": 0,
      "per_task_discipline": 0.029411764705882353
    },
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 35,
      "tasks_completed": 34,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 34
    },
    "scores": {
      "cli_efficiency": 0,
      "skill_accuracy": 0.6,
      "planning_quality": 0,
      "time_efficiency": 0.6375,
      "composite": 0.28485294117647053
    },
    "humanReview": {
      "score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": null,
          "notes": null
        }
      },
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [
        {
          "skill": "/gad:plan-phase",
          "when": "before implementation",
          "triggered": true
        },
        {
          "skill": "/gad:execute-phase",
          "when": "per phase",
          "triggered": true
        },
        {
          "skill": "/gad:task-checkpoint",
          "when": "between tasks",
          "triggered": true
        },
        {
          "skill": "/gad:auto-conventions",
          "when": "after first code phase",
          "triggered": false
        },
        {
          "skill": "/gad:verify-work",
          "when": "after phase completion",
          "triggered": false
        }
      ],
      "accuracy": 0.6
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 1,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 4,
      "commit_discipline": 0.25
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v4",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T03:42:00.000Z",
      "ended": "2026-04-07T04:20:00.000Z",
      "duration_minutes": 38,
      "phases_completed": 10,
      "tasks_completed": 19
    },
    "tokenUsage": {
      "total_tokens": 136930,
      "tool_uses": 189
    },
    "gitAnalysis": {
      "total_commits": 19,
      "task_id_commits": 19,
      "batch_commits": 2,
      "source_files_created": 20,
      "state_updates": 19,
      "decisions_added": 0,
      "per_task_discipline": 0.89
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "fully_met": 12,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 10,
      "tasks_planned": 19,
      "tasks_completed": 19,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 19,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.92,
      "per_task_discipline": 0.89,
      "composite": 0.916
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 19,
      "commit_discipline": 1
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v5",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T07:00:00.000Z",
      "ended": "2026-04-07T07:18:00.000Z",
      "duration_minutes": 18,
      "phases_completed": 12,
      "tasks_completed": 12
    },
    "tokenUsage": {
      "total_tokens": 92278,
      "tool_uses": 110
    },
    "gitAnalysis": {
      "total_commits": 11,
      "task_id_commits": 10,
      "batch_commits": 1,
      "source_files_created": 35,
      "state_updates": 12,
      "decisions_added": 0,
      "per_task_discipline": 0.83,
      "verify_commits": 1,
      "conventions_created": true
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "fully_met": 12,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 12,
      "tasks_planned": 12,
      "tasks_completed": 12,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 12,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 1,
      "time_efficiency": 0.963,
      "per_task_discipline": 0.83,
      "composite": 0.8123,
      "human_review": 0,
      "auto_composite": null
    },
    "humanReview": {
      "score": 0,
      "notes": "Blank screen, no UI renders, no main menu, no playable content. Systems may exist in code but nothing visible. Eval must require vertical slice with playable demo.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T01:01:12.987Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0,
          "notes": "Blank screen, no UI renders, no main menu, no playable content. Systems may exist in code but nothing visible. Eval must require vertical slice with playable demo."
        }
      },
      "aggregate_score": 0,
      "notes": "Blank screen, no UI renders, no main menu, no playable content. Systems may exist in code but nothing visible. Eval must require vertical slice with playable demo.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T01:01:12.987Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [
        {
          "skill": "/gad:plan-phase",
          "when": "before implementation",
          "triggered": true
        },
        {
          "skill": "/gad:execute-phase",
          "when": "per phase",
          "triggered": true
        },
        {
          "skill": "/gad:task-checkpoint",
          "when": "between tasks",
          "triggered": true
        },
        {
          "skill": "/gad:auto-conventions",
          "when": "after first code phase",
          "triggered": true
        },
        {
          "skill": "/gad:verify-work",
          "when": "after phase completion",
          "triggered": true
        },
        {
          "skill": "/gad:check-todos",
          "when": "session start",
          "triggered": true
        }
      ],
      "accuracy": 1
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.8123,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 11,
      "commit_discipline": 0.9090909090909091
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v6",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 20,
      "phases_completed": 8,
      "tasks_completed": 13
    },
    "tokenUsage": {
      "total_tokens": 138835,
      "tool_uses": 150
    },
    "gitAnalysis": {
      "total_commits": 13,
      "task_id_commits": 11,
      "batch_commits": 0,
      "per_task_discipline": 0.85
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "Build exists but renders blank screen on file:// open. ES module + KAPLAY canvas requires web server.",
      "fully_met": 0,
      "partially_met": 0,
      "not_met": 12,
      "coverage_ratio": 0
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 8,
      "tasks_planned": 13,
      "tasks_completed": 13,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 13,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0,
      "planning_quality": 1,
      "per_task_discipline": 0.85,
      "skill_accuracy": 0.833,
      "time_efficiency": 0.958,
      "human_review": 0,
      "composite": 0.347,
      "auto_composite": null
    },
    "humanReview": {
      "score": 0,
      "notes": "Blank screen on file:// open. KAPLAY canvas game with ES module script requires web server. Gate criterion failed. Same failure mode as v5.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T02:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0,
          "notes": "Blank screen on file:// open. KAPLAY canvas game with ES module script requires web server. Gate criterion failed. Same failure mode as v5."
        }
      },
      "aggregate_score": 0,
      "notes": "Blank screen on file:// open. KAPLAY canvas game with ES module script requires web server. Gate criterion failed. Same failure mode as v5.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T02:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [
        {
          "skill": "/gad:plan-phase",
          "when": "before implementation",
          "triggered": true
        },
        {
          "skill": "/gad:execute-phase",
          "when": "per phase",
          "triggered": true
        },
        {
          "skill": "/gad:task-checkpoint",
          "when": "between tasks",
          "triggered": true
        },
        {
          "skill": "/gad:auto-conventions",
          "when": "after first code phase",
          "triggered": false
        },
        {
          "skill": "/gad:verify-phase",
          "when": "after phase completion",
          "triggered": true
        },
        {
          "skill": "/gad:check-todos",
          "when": "session start",
          "triggered": true
        }
      ],
      "accuracy": 0.833
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.347,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 13,
      "commit_discipline": 0.8461538461538461
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v7",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 24,
      "phases_completed": 9,
      "tasks_completed": 17
    },
    "tokenUsage": {
      "total_tokens": 93632,
      "tool_uses": 137
    },
    "gitAnalysis": {
      "total_commits": 21,
      "task_id_commits": 17,
      "batch_commits": 0,
      "per_task_discipline": 0.81
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "Game renders, title screen works, combat works. But game loop breaks — after combat, player is stuck with no route back to room navigation.",
      "fully_met": 7,
      "partially_met": 3,
      "not_met": 2,
      "coverage_ratio": 0.708
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 9,
      "tasks_planned": 17,
      "tasks_completed": 17,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 17,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0.708,
      "planning_quality": 1,
      "per_task_discipline": 0.81,
      "skill_accuracy": 0.833,
      "time_efficiency": 0.95,
      "human_review": 0.3,
      "composite": 0.668
    },
    "humanReview": {
      "score": 0.3,
      "notes": "Game renders, better UI/layout than other evals. But game loop is broken — after combat, player gets stuck with no navigation. Cannot progress past first encounter. UI is bland but structured. Has fallback data (good defensive coding). Score 0.30: renders and partially playable but broken core loop.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.3,
          "notes": "Game renders, better UI/layout than other evals. But game loop is broken — after combat, player gets stuck with no navigation. Cannot progress past first encounter. UI is bland but structured. Has fallback data (good defensive coding). Score 0.30: renders and partially playable but broken core loop."
        }
      },
      "aggregate_score": 0.3,
      "notes": "Game renders, better UI/layout than other evals. But game loop is broken — after combat, player gets stuck with no navigation. Cannot progress past first encounter. UI is bland but structured. Has fallback data (good defensive coding). Score 0.30: renders and partially playable but broken core loop.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [
        {
          "skill": "/gad:plan-phase",
          "when": "before implementation",
          "triggered": true
        },
        {
          "skill": "/gad:execute-phase",
          "when": "per phase",
          "triggered": true
        },
        {
          "skill": "/gad:task-checkpoint",
          "when": "between tasks",
          "triggered": true
        },
        {
          "skill": "/gad:auto-conventions",
          "when": "after first code phase",
          "triggered": true
        },
        {
          "skill": "/gad:verify-phase",
          "when": "after phase completion",
          "triggered": true
        },
        {
          "skill": "/gad:check-todos",
          "when": "session start",
          "triggered": false
        }
      ],
      "accuracy": 0.833
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.36800000000000005,
      "plan_adherence_delta": 0,
      "produced_artifact_density": 0.08333333333333333,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 21,
      "commit_discipline": 0.8095238095238095
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v8",
    "workflow": "gad",
    "requirementsVersion": "v3",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 16,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 1291,
      "tool_uses": 62,
      "note": "rate-limited"
    },
    "gitAnalysis": {
      "total_commits": 0,
      "task_id_commits": 0,
      "batch_commits": 0,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "G1 (game-loop) partial — renders. G2 (spell-crafting) FAILED — crafting system broken, breaks the game when used. G3 (ui-quality) partial — has particle effects and colors, but text is hard to read, ASCII for map/spells/bags, no sourced sprites.",
      "fully_met": 2,
      "partially_met": 4,
      "not_met": 6,
      "coverage_ratio": 0.33
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "decisions_captured": 0
    },
    "scores": {
      "requirement_coverage": 0.33,
      "planning_quality": 0,
      "per_task_discipline": 0,
      "skill_accuracy": 0.17,
      "time_efficiency": 0.967,
      "human_review": 0.2,
      "composite": 0.177
    },
    "humanReview": {
      "score": 0.2,
      "notes": "Better particle effects on main menu and better colors than previous GAD runs. However, crafting system broke the game when used (unusable). Old ASCII text design for map/spells/bags menus. Hard to read text. Added icons but didn't search for sourced sprites. 0 commits — rate limit hit before agent could finalize. Score 0.20: has some visual improvements but broken crafting gates it.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.2,
          "notes": "Better particle effects on main menu and better colors than previous GAD runs. However, crafting system broke the game when used (unusable). Old ASCII text design for map/spells/bags menus. Hard to read text. Added icons but didn't search for sourced sprites. 0 commits — rate limit hit before agent could finalize. Score 0.20: has some visual improvements but broken crafting gates it."
        }
      },
      "aggregate_score": 0.2,
      "notes": "Better particle effects on main menu and better colors than previous GAD runs. However, crafting system broke the game when used (unusable). Old ASCII text design for map/spells/bags menus. Hard to read text. Added icons but didn't search for sourced sprites. 0 commits — rate limit hit before agent could finalize. Score 0.20: has some visual improvements but broken crafting gates it.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.md (eval meta)",
      "path": "evals/escape-the-dungeon/REQUIREMENTS.md",
      "content": "# Eval: Escape the Dungeon\n\n## What this eval measures\n\n1. **Skill trigger accuracy** — are /gad:* skills triggered at the right moments (discuss before plan, plan before execute, verify after execute)\n2. **Planning quality** — does the agent produce coherent phases, tasks, decisions from a complex game design doc\n3. **CLI context efficiency** — does gad snapshot/context deliver what the agent needs without reading dozens of files\n4. **End-to-end loop** — does the full GAD loop (discuss → plan → execute → verify → score) work on a real implementation\n5. **Time-to-completion** — wall clock and token counts from requirements to working game\n\n## Eval flow\n\n1. Pre-planning discussion: `/gad:discuss-phase` — collect open questions, clarify requirements, record the conversation\n2. Phase planning: `/gad:plan-phase` — break the game into implementable phases with tasks\n3. Execution: `/gad:execute-phase` — implement each phase, update planning docs, commit\n4. Verification: `/gad:verify-work` — check each phase against its definition of done\n5. Scoring: TRACE.json + SCORE.md produced at end\n\n## Hosted demo and source (portfolio site)\n\nA **production build** of the game can be copied into the **custom_portfolio** repo at `apps/portfolio/public/evals/escape-the-dungeon/` so it is served at **`/evals/escape-the-dungeon/`** (playable in the browser). **Game source** lives in this repo under **`evals/escape-the-dungeon/game/`** (Vite + TypeScript + Kaplay). Traces and scores remain under `evals/escape-the-dungeon/vN/`.\n\n## Source material\n\n- `source-GAMEPLAY-DESIGN.xml` — full gameplay design (500+ lines of XML)\n- `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` — canonical stat names and engine mappings\n- `template/.planning/REQUIREMENTS.xml` — structured requirements derived from source docs\n\n## Human review\n\nAfter the eval agent completes, a human opens the build output (`gad eval open escape-the-dungeon`)\nand scores it 0.0-1.0 via `gad eval review`. The rubric:\n\n| Score | Meaning |\n|-------|---------|\n| 0.0 | Blank screen, nothing renders |\n| 0.1-0.3 | Something renders but not playable (menus don't work, can't start game) |\n| 0.4-0.6 | Playable vertical slice — can start game, navigate, have one interaction |\n| 0.7-0.8 | Multiple interactions work, UI is functional, core loop is playable |\n| 0.9-1.0 | Polished, all major systems present and working, feels like a real game |\n\n**Gate:** If the build output shows a blank screen, `requirement_coverage` is overridden to 0\nregardless of what the automated trace says. Code that doesn't render has zero coverage.\n\n## v5 finding\n\nv5 scored auto_composite 0.955 but human_review 0.0 (blank screen). The agent built systems\ncode but no visible UI. Requirements updated to mandate UI-first build order and a playable\nvertical slice as the primary success criterion.\n",
      "format": "md"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.02300000000000002,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 0,
      "commit_discipline": null
    }
  },
  {
    "project": "escape-the-dungeon",
    "version": "v9",
    "workflow": "gad",
    "requirementsVersion": "v4",
    "date": "2026-04-09",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 4,
    "frameworkVersion": "1.32.0",
    "frameworkCommit": "3ef0bb5",
    "frameworkBranch": "main",
    "frameworkCommitTs": null,
    "frameworkStamp": "v1.32.0+3ef0bb5",
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-09T04:26:00.000Z",
      "ended": "2026-04-09T04:40:00.000Z",
      "duration_minutes": 14,
      "phases_completed": 1,
      "tasks_completed": 4,
      "rate_limited": true,
      "rate_limit_note": "Hit account-level rate limit at tool_uses=81 (highest of three conditions). Planned 7 phases + 23 tasks before rate-limit. Completed phase 01 fully + task 02-01."
    },
    "tokenUsage": {
      "total_tokens": 3238,
      "tool_uses": 81,
      "note": "Highest tool_uses of the three conditions — most planning overhead upfront."
    },
    "gitAnalysis": {
      "total_commits": 0,
      "task_id_commits": 0,
      "batch_commits": 0,
      "per_task_discipline": 0,
      "note": "No commits — agent was running in a worktree. Rate limit hit before commit discipline was exercised."
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "G1 PARTIAL — title screen scene renders, scene transition to New Game NOT IMPLEMENTED (task 02-02 was next). No room navigation. G2 NOT MET. G3 PARTIAL — title screen styled. G4 NOT MET. RATE LIMITED at task 02-02. Phase 01 scaffold passed its own verification with working build.",
      "fully_met": 1,
      "partially_met": 3,
      "not_met": 8,
      "coverage_ratio": 0.208
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": false,
      "emergence_score": 0.75,
      "note": "Full GAD planning suite produced. Architecture: scenes/, systems/, types/, data/, main.ts — clean separation. Did not author new skills (framework provides them) but used the planning-doc architecture per GAD conventions."
    },
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 23,
      "tasks_completed": 4,
      "tasks_blocked": 19,
      "decisions_captured": 0,
      "state_updates": 2,
      "state_stale_count": 0,
      "note": "FULL XML planning suite produced: ROADMAP.xml (7 phases), TASK-REGISTRY.xml (23 tasks), STATE.xml, DECISIONS.xml (empty), REQUIREMENTS.xml, VERIFICATION.md (phase 01 verified PASS). Highest planning_quality of any eval run. Framework planning overhead clearly visible."
    },
    "scores": {
      "requirement_coverage": 0.208,
      "planning_quality": 0.85,
      "per_task_discipline": 0,
      "skill_accuracy": null,
      "time_efficiency": 0.533,
      "human_review": 0.05,
      "composite": null
    },
    "humanReview": {
      "score": 0.05,
      "notes": "Rate-limited GAD v9. Start screen loads but nothing beyond it — regressed vs earlier GAD builds. Preserved as data point but excluded from cross-round quality per gad-63. User playtest 2026-04-09.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T16:08:04.201Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.05,
          "notes": "Rate-limited GAD v9. Start screen loads but nothing beyond it — regressed vs earlier GAD builds. Preserved as data point but excluded from cross-round quality per gad-63. User playtest 2026-04-09."
        }
      },
      "aggregate_score": 0.05,
      "notes": "Rate-limited GAD v9. Start screen loads but nothing beyond it — regressed vs earlier GAD builds. Preserved as data point but excluded from cross-round quality per gad-63. User playtest 2026-04-09.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T16:08:04.201Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.05,
      "plan_adherence_delta": 19,
      "produced_artifact_density": 0.14285714285714285,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 0,
      "commit_discipline": null
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v1",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 12,
      "phases_completed": 7,
      "tasks_completed": 21
    },
    "tokenUsage": {
      "total_tokens": 67751,
      "tool_uses": 62
    },
    "gitAnalysis": {
      "total_commits": 2,
      "task_id_commits": 0,
      "batch_commits": 2,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "Build exists but renders blank screen on file:// open. Same ES module issue as GAD version.",
      "fully_met": 0,
      "partially_met": 0,
      "not_met": 12,
      "coverage_ratio": 0
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": true,
      "emergence_score": 1
    },
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 21,
      "tasks_completed": 21,
      "tasks_blocked": 0,
      "decisions_captured": 10,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0,
      "workflow_emergence": 1,
      "implementation_quality": 0,
      "iteration_evidence": 0,
      "time_efficiency": 0.975,
      "human_review": 0.1,
      "composite": 0.198
    },
    "humanReview": {
      "score": 0.1,
      "notes": "Main menu renders with New Game button visible. Cannot start game — clicking New Game does not progress. Broken build. Score 0.10 for rendering menu only.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T02:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.1,
          "notes": "Main menu renders with New Game button visible. Cannot start game — clicking New Game does not progress. Broken build. Score 0.10 for rendering menu only."
        }
      },
      "aggregate_score": 0.1,
      "notes": "Main menu renders with New Game button visible. Cannot start game — clicking New Game does not progress. Broken build. Score 0.10 for rendering menu only.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T02:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon-bare/template/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.098,
      "plan_adherence_delta": 0,
      "produced_artifact_density": 0,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 2,
      "commit_discipline": 0
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v2",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 21,
      "phases_completed": 7,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 87661,
      "tool_uses": 110
    },
    "gitAnalysis": {
      "total_commits": 6,
      "task_id_commits": 0,
      "batch_commits": 6,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "Game renders, title works, New Game works, room navigation works, combat works, dialogue works, menus work. Very playable vertical slice. Missing: rune forge, icons, visual polish.",
      "fully_met": 9,
      "partially_met": 2,
      "not_met": 1,
      "coverage_ratio": 0.833
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": true,
      "emergence_score": 1
    },
    "planningQuality": {
      "phases_planned": 7,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0.833,
      "workflow_emergence": 1,
      "implementation_quality": 0.7,
      "iteration_evidence": 0,
      "time_efficiency": 0.956,
      "human_review": 0.5,
      "composite": 0.601
    },
    "humanReview": {
      "score": 0.5,
      "notes": "Most playable game of all evals. Full game loop works: title → new game → rooms → combat → dialogue → navigation. UX and flow are good. UI is very ASCII/plain — needs spacing, icons, better styling. Color coding is good. No spell crafting despite rune system in requirements. Rest room doesn't offer forge. Score 0.50: playable vertical slice but visually rough.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.5,
          "notes": "Most playable game of all evals. Full game loop works: title → new game → rooms → combat → dialogue → navigation. UX and flow are good. UI is very ASCII/plain — needs spacing, icons, better styling. Color coding is good. No spell crafting despite rune system in requirements. Rest room doesn't offer forge. Score 0.50: playable vertical slice but visually rough."
        }
      },
      "aggregate_score": 0.5,
      "notes": "Most playable game of all evals. Full game loop works: title → new game → rooms → combat → dialogue → navigation. UX and flow are good. UI is very ASCII/plain — needs spacing, icons, better styling. Color coding is good. No spell crafting despite rune system in requirements. Rest room doesn't offer forge. Score 0.50: playable vertical slice but visually rough.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon-bare/template/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.10099999999999998,
      "plan_adherence_delta": 0,
      "produced_artifact_density": 0,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 6,
      "commit_discipline": 0
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v3",
    "workflow": "bare",
    "requirementsVersion": "v3",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 15,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 1877,
      "tool_uses": 53,
      "note": "rate-limited — single giant commit"
    },
    "gitAnalysis": {
      "total_commits": 1,
      "task_id_commits": 0,
      "batch_commits": 1,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "G1 (game-loop) partial — playable but no floor progression after boss. G2 (spell-crafting) not clearly implemented. G3 (ui-quality) BEST of round 3 — best UI/UX by far.",
      "fully_met": 8,
      "partially_met": 3,
      "not_met": 1,
      "coverage_ratio": 0.792
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": false,
      "created_architecture_docs": true,
      "created_reusable_skills": false,
      "emergence_score": 0.5
    },
    "planningQuality": null,
    "scores": {
      "requirement_coverage": 0.792,
      "workflow_emergence": 0.5,
      "implementation_quality": 0.75,
      "iteration_evidence": 0,
      "time_efficiency": 0.969,
      "human_review": 0.7,
      "composite": 0.526
    },
    "humanReview": {
      "score": 0.7,
      "notes": "Best UI/UX of all eval runs by far. Most enjoyable and playable. Functional game loop with combat and dialogue. Missing: floor progression after boss (can grind same floor), no clear spell crafting path. Regressed on commit discipline under pressure (1 giant commit vs v2's 6). Score 0.70: most enjoyable game across all experiments.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.7,
          "notes": "Best UI/UX of all eval runs by far. Most enjoyable and playable. Functional game loop with combat and dialogue. Missing: floor progression after boss (can grind same floor), no clear spell crafting path. Regressed on commit discipline under pressure (1 giant commit vs v2's 6). Score 0.70: most enjoyable game across all experiments."
        }
      },
      "aggregate_score": 0.7,
      "notes": "Best UI/UX of all eval runs by far. Most enjoyable and playable. Functional game loop with combat and dialogue. Missing: floor progression after boss (can grind same floor), no clear spell crafting path. Regressed on commit discipline under pressure (1 giant commit vs v2's 6). Score 0.70: most enjoyable game across all experiments.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.md (eval meta)",
      "path": "evals/escape-the-dungeon-bare/REQUIREMENTS.md",
      "content": "# Eval: Escape the Dungeon (Bare — No Framework)\n\n## Purpose\n\nBaseline comparison eval. The agent builds the same game as `escape-the-dungeon` but\n**without the GAD framework**. No `.planning/` directory, no `gad` CLI, no `/gad:*` skills.\n\nInstead, the agent is given a minimal AGENTS.md that instructs it to:\n1. Research the \"Ralph Wiggum loop\" (plan-do-check-act for AI coding agents)\n2. Create its own workflow artifacts and tracking format\n3. Build reusable \"skills\" (documented patterns) when it encounters repeated problems\n4. Iterate on its own process as it implements\n\nThis measures what an agent does *without* a structured framework — do they naturally\ncreate tracking? How organized is their output? How does implementation quality compare?\n\n## What this eval measures\n\n1. **Requirement coverage** — same 12 criteria as escape-the-dungeon. Did the game get built?\n2. **Workflow emergence** — did the agent create any tracking system? How structured was it?\n   - Created task lists or checklists? (0.25)\n   - Created state tracking / progress notes? (0.25)\n   - Created architecture or design docs? (0.25)\n   - Created reusable patterns / skills? (0.25)\n3. **Implementation quality** — does the code compile, run, and produce a playable game?\n4. **Iteration evidence** — did the agent revisit and improve its workflow during implementation?\n   Score = (workflow_updates / total_phases). A score of 0 means \"set it and forgot it.\"\n5. **Time efficiency** — wall clock / token usage\n6. **Human review** — playability, code quality, architecture soundness\n\n## Game requirements (identical to escape-the-dungeon)\n\nThe game requirements are in `REQUIREMENTS.xml` in the template. They are the same 12\nsuccess criteria as the GAD version — same game, same scope, same deliverables.\n\n## Comparison with escape-the-dungeon (GAD version)\n\nAfter both evals are scored, compare:\n\n| Dimension | Bare | GAD | Delta |\n|-----------|------|-----|-------|\n| requirement_coverage | ? | ? | GAD advantage? |\n| workflow tracking | emergent | structured | how different? |\n| per_task_discipline | ? | 0.83 | is GAD more disciplined? |\n| time_efficiency | ? | 0.963 | faster or slower? |\n| human_review | ? | ? | which game is more polished? |\n\nThe hypothesis: GAD provides structure that leads to better discipline and traceability,\nbut a skilled agent without a framework may produce equivalent or better code if it\ndevelops its own process. This eval tests that hypothesis.\n\n## Scoring\n\n| Dimension | Weight | How scored |\n|-----------|--------|-----------|\n| requirement_coverage | 0.25 | Same 12 criteria as escape-the-dungeon |\n| workflow_emergence | 0.20 | 4 sub-criteria scored 0-1, averaged |\n| implementation_quality | 0.20 | Build succeeds + game runs + no critical bugs |\n| iteration_evidence | 0.15 | workflow_updates / total_implementation_phases |\n| time_efficiency | 0.05 | 1 - (duration / 480), clamped [0,1] |\n| human_review | 0.15 | Human score via `gad eval review` |\n\nWhen human_review is null, remaining weights normalize to sum to 1.0.\n",
      "format": "md"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.17399999999999993,
      "plan_adherence_delta": null,
      "produced_artifact_density": 0,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 1,
      "commit_discipline": 0
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v4",
    "workflow": "bare",
    "requirementsVersion": "v4",
    "date": "2026-04-09",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 4,
    "frameworkVersion": "1.32.0",
    "frameworkCommit": "3ef0bb5",
    "frameworkBranch": "main",
    "frameworkCommitTs": null,
    "frameworkStamp": "v1.32.0+3ef0bb5",
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-09T04:26:00.000Z",
      "ended": "2026-04-09T04:40:00.000Z",
      "duration_minutes": 14,
      "phases_completed": 1,
      "tasks_completed": 1,
      "rate_limited": true,
      "rate_limit_note": "Hit account-level rate limit at tool_uses=45. Shared rate bucket with parallel GAD + Emergent runs."
    },
    "tokenUsage": {
      "total_tokens": 1682,
      "tool_uses": 45,
      "note": "rate-limited — partial implementation"
    },
    "gitAnalysis": {
      "total_commits": 0,
      "task_id_commits": 0,
      "batch_commits": 0,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "G1 partial (scaffold only). G2/G3/G4 NOT MET. RATE LIMITED before any gate could be verified. Vite build succeeds manually (54 KB, 18 modules) but game loop is not wired end-to-end.",
      "fully_met": 0,
      "partially_met": 3,
      "not_met": 9,
      "coverage_ratio": 0.125
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": false,
      "created_architecture_docs": false,
      "created_reusable_skills": false,
      "emergence_score": 0.3
    },
    "planningQuality": {
      "phases_planned": 10,
      "tasks_planned": 10,
      "tasks_completed": 1,
      "tasks_blocked": 9,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0,
      "note": "Wrote game/.planning/worklog.md with 10-step plan matching 4 gates. Actual progress: step 1 (project scaffold) complete."
    },
    "scores": {
      "requirement_coverage": 0.125,
      "planning_quality": 0.1,
      "per_task_discipline": 0,
      "skill_accuracy": null,
      "time_efficiency": 0.533,
      "human_review": null,
      "composite": null
    },
    "humanReview": {
      "score": null,
      "notes": "RATE LIMITED before completion. 6 source files written, vite build succeeds manually (54 KB bundle). worklog.md shows 10-step plan covering all 4 gates. Implementation depth: step 1 of 10 complete. DO NOT include in cross-round comparisons against completed runs.",
      "reviewed_by": null,
      "reviewed_at": null
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": null,
          "notes": "RATE LIMITED before completion. 6 source files written, vite build succeeds manually (54 KB bundle). worklog.md shows 10-step plan covering all 4 gates. Implementation depth: step 1 of 10 complete. DO NOT include in cross-round comparisons against completed runs."
        }
      },
      "aggregate_score": null,
      "notes": "RATE LIMITED before completion. 6 source files written, vite build succeeds manually (54 KB bundle). worklog.md shows 10-step plan covering all 4 gates. Implementation depth: step 1 of 10 complete. DO NOT include in cross-round comparisons against completed runs.",
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon-bare/template/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": {
      "filename": "find-sprites.md",
      "content": "---\nname: find-sprites\ndescription: Source visual assets (sprites, icons, tilesets, portraits) for a game or UI-heavy build in a way that yields a coherent, intentional look instead of a debug-console aesthetic. Use this skill when you need art for rooms, entities, UI controls, HP bars, spell icons, status effects, or any other visual element; when the build is failing its UI-quality gate because it looks unintentional; or when you're about to fall back to raw ASCII/text UI. The goal is \"looks like someone designed it\" — not photorealism, not 1:1 with AAA games, but internally consistent and readable.\n---\n\n# find-sprites\n\nAgents left to their own devices tend to ship raw text UI, emoji salad, or inconsistent asset mixtures. This skill exists because the `ui-quality` gate consistently fails when asset sourcing is treated as an afterthought. Source assets deliberately, in preference order, and commit to one visual direction.\n\n## Preference order\n\nWork down this list. Only drop to the next tier if the current tier cannot cover your need.\n\n### Tier 1 — Installable icon and sprite packages\n\nLightweight, well-typed, import cleanly. Best for UI iconography, status effects, resource icons, and action buttons.\n\n| Package | Use for |\n|---|---|\n| `lucide-react` / `lucide` | UI icons, buttons, controls, status (~1500 icons) |\n| `@iconify/react` / `@iconify-json/*` | Broadest set — game-icons pack, emojione, twemoji, etc. |\n| `@tabler/icons` | Clean outline style, good for minimalist UI |\n| `heroicons` | Simple outline + solid, Tailwind-friendly |\n\nFor game iconography specifically, **`@iconify-json/game-icons`** (Delapouite/Lorc) is the single highest-leverage install:\n\n```sh\nnpm install @iconify/react @iconify-json/game-icons\n```\n\n```tsx\nimport { Icon } from \"@iconify/react\";\n<Icon icon=\"game-icons:crossed-swords\" width={32} />\n<Icon icon=\"game-icons:fire-spell-cast\" width={32} />\n<Icon icon=\"game-icons:health-potion\" width={32} />\n```\n\n~4000 game-themed icons covering weapons, spells, monsters, resources, status effects. Use this before anything else for room icons, spell icons, enemy representations, and resource bars.\n\n### Tier 2 — Web-searched free/open-license art\n\nWhen you need actual sprites (not icons) — tilesets, character portraits, monster sprites, environment art.\n\n**Preferred sources** (all free, all permissively licensed — always confirm the specific asset's license before shipping):\n\n- **OpenGameArt.org** — CC0 / CC-BY tilesets, sprites, UI packs. Search \"dungeon tileset CC0\", \"roguelike monsters CC0\".\n- **Kenney.nl** — huge, consistent, CC0 asset packs. \"1-Bit Pack\", \"Roguelike/RPG Pack\", \"UI Pack\". Single-author → visual coherence is free.\n- **itch.io free assets** — filter by \"free\" and check each asset's license. Often CC0 or CC-BY.\n- **Game-icons.net** — the web source behind the Iconify pack above. SVG download if you need edits.\n\n**Process:**\n\n1. Pick ONE source pack for your core visual direction. Do not mix Kenney's 1-bit with Kenney's top-down pixel — pick one.\n2. Download the pack (or the specific sprites you need) into `game/public/assets/sprites/`.\n3. Record the source and license in `game/public/assets/LICENSES.md`:\n   ```\n   - dungeon-tileset/ — Kenney.nl \"Roguelike/RPG Pack\" — CC0\n   - monsters/ — OpenGameArt \"Pixel Monster Pack\" by <author> — CC-BY\n   ```\n4. Reference assets via static paths: `<img src=\"/assets/sprites/monsters/slime.png\" />`.\n\n### Tier 3 — Generated placeholder art\n\nWhen you cannot find a matching asset and time is short. Quality ranking:\n\n- **SVG drawn by hand** (inline or file) — scales, sharp, themeable via CSS.\n- **Canvas-drawn shapes** — works for simple top-down tiles, procedural dungeon cells.\n- **CSS-styled divs with gradients + borders** — good enough for room-type differentiation.\n- **Emoji fallback** — acceptable for status indicators and small UI accents only. Do NOT build your entire UI out of emoji — it reads as lazy even when consistent.\n\n### Tier 4 — Geometric primitives\n\nSolid-colored rectangles, circles, borders. **Counts against your UI-quality score even if used intentionally.** Only acceptable for background panels or temporary placeholders you will replace before shipping.\n\n### Tier 5 — Raw ASCII / text-only\n\nThis is a gate failure. Do not ship text-only UI. If you are tempted to, go back to Tier 1 and install the game-icons pack — it takes 30 seconds.\n\n## Coherence over polish\n\nOne consistent visual direction beats a mix of high-quality assets from different styles. A game built entirely from Kenney's 1-bit pack looks intentional. A game mixing hand-drawn portraits, pixel monsters, and flat-vector UI icons looks broken — even if each individual asset is beautiful.\n\nBefore sourcing anything, decide:\n\n1. **Perspective** — top-down, side-view, or UI-only?\n2. **Fidelity** — pixel, vector, or illustrated?\n3. **Palette** — dark fantasy, bright cartoon, monochrome?\n\nThen source only assets matching those three answers. If a must-have asset doesn't match, either adapt it (recolor, resize) or redraw the rest of your direction to match it.\n\n## Licensing\n\nAlways check the license. CC0 is the simplest — no attribution required, no restrictions. CC-BY requires attribution (include the author in `LICENSES.md`). Avoid CC-BY-NC (non-commercial) and CC-BY-SA (share-alike viral) unless you've confirmed your project's distribution model is compatible. Never ship assets of unknown provenance.\n\n## Failure modes\n\n- **Mixing styles.** Pixel + vector + illustrated = incoherent. Pick one.\n- **Installing an icon pack and never using it.** The install is the easy part. Actually replace placeholder text with `<Icon />` in every UI surface.\n- **Downloading a tileset without a license check.** Ship-blocker if the license forbids the use.\n- **Deferring art to \"after mechanics work.\"** The UI-quality gate is scored on what actually ships. An unpolished build with working mechanics still fails the gate.\n- **Using emoji as the entire UI.** Reads as a debugger, not a game.\n",
      "bytes": 6073,
      "total_skills": 2
    },
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 9,
      "produced_artifact_density": 0.21428571428571427,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 0,
      "commit_discipline": null
    }
  },
  {
    "project": "escape-the-dungeon-bare",
    "version": "v5",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-09",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": "1.32.0",
    "frameworkCommit": "459dc36",
    "frameworkBranch": "main",
    "frameworkCommitTs": "2026-04-09T00:22:35-05:00",
    "frameworkStamp": "v1.32.0+459dc36",
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-09T05:24:02.406Z",
      "ended": "2026-04-09T05:35:47.858Z",
      "duration_minutes": 12,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "cli_efficiency": null,
      "skill_accuracy": null,
      "planning_quality": null,
      "time_efficiency": 0.975,
      "composite": null,
      "human_review": 0.805
    },
    "humanReview": {
      "rubric_version": "v1",
      "dimensions": {
        "playability": {
          "score": 0.7,
          "notes": null
        },
        "ui_polish": {
          "score": 0.85,
          "notes": null
        },
        "mechanics_implementation": {
          "score": 0.9,
          "notes": null
        },
        "ingenuity_requirement_met": {
          "score": 0.95,
          "notes": null
        },
        "stability": {
          "score": 0.55,
          "notes": null
        }
      },
      "aggregate_score": 0.805,
      "notes": "Highest ingenuity of any round-4 run (user: 'highest ingenuity out of all runs'). Strengths: multi-enemy combat encounters (very creative), forge room UI is great (icons, spacing, placement, highlighting), training affinity mechanic 'pretty sweet' — user loved it, spell crafting loop enjoyable for finding combos yourself, pressure mechanics landed clearly (Fungal Sovereign: resistant to physical / immune to fire called out subtly on the map — user prefers subtle hints over explicit), goals feel earned. Weaknesses: (1) combat lacks targeting — user prefers Unicorn-Overlord-style rule-based simulation with board positioning (chess-like), action policies per entity traits, initiative-driven turn order (captured as v5 R-v5.13, R-v5.14); (2) affinity reward loop unclear — no visible reward for boosting a rune a lot, users will want curiosity payoff (R-v5.16); (3) navigation of exits/rooms difficult — only dropdown, no visual map with player location (R-v5.17); (4) unclear visual player-vs-enemy identity in encounters (ooze looked ambiguous) — user wants Pokemon or Unicorn-Overlord style (R-v5.18); (5) glitchy redraws on button clicks (observed across ALL round-4 builds) — likely per-tick redraw, remove ticks entirely, use event-driven updates, real-time 1hr=1day game time (R-v5.15, R-v5.21); (6) BUG: rune forge lets you craft a spell using the same rune twice which boosts that rune's affinity twice — should be forbidden per-spell but allowed across DIFFERENT spells (R-v5.20, bugs.json). Other user notes: clear-button UX is better for controller so keep it; user really likes how the in-game rune/spell system mirrors the emergent skill/merge hypothesis; wants spell-mixing-spells (use existing spells as ingredients too, procedural-but-semantic naming — R-v5.19).",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T21:07:17.787Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "v1",
      "dimensions": {
        "playability": {
          "score": 0.7,
          "notes": null
        },
        "ui_polish": {
          "score": 0.85,
          "notes": null
        },
        "mechanics_implementation": {
          "score": 0.9,
          "notes": null
        },
        "ingenuity_requirement_met": {
          "score": 0.95,
          "notes": null
        },
        "stability": {
          "score": 0.55,
          "notes": null
        }
      },
      "aggregate_score": 0.805,
      "notes": "Highest ingenuity of any round-4 run (user: 'highest ingenuity out of all runs'). Strengths: multi-enemy combat encounters (very creative), forge room UI is great (icons, spacing, placement, highlighting), training affinity mechanic 'pretty sweet' — user loved it, spell crafting loop enjoyable for finding combos yourself, pressure mechanics landed clearly (Fungal Sovereign: resistant to physical / immune to fire called out subtly on the map — user prefers subtle hints over explicit), goals feel earned. Weaknesses: (1) combat lacks targeting — user prefers Unicorn-Overlord-style rule-based simulation with board positioning (chess-like), action policies per entity traits, initiative-driven turn order (captured as v5 R-v5.13, R-v5.14); (2) affinity reward loop unclear — no visible reward for boosting a rune a lot, users will want curiosity payoff (R-v5.16); (3) navigation of exits/rooms difficult — only dropdown, no visual map with player location (R-v5.17); (4) unclear visual player-vs-enemy identity in encounters (ooze looked ambiguous) — user wants Pokemon or Unicorn-Overlord style (R-v5.18); (5) glitchy redraws on button clicks (observed across ALL round-4 builds) — likely per-tick redraw, remove ticks entirely, use event-driven updates, real-time 1hr=1day game time (R-v5.15, R-v5.21); (6) BUG: rune forge lets you craft a spell using the same rune twice which boosts that rune's affinity twice — should be forbidden per-spell but allowed across DIFFERENT spells (R-v5.20, bugs.json). Other user notes: clear-button UX is better for controller so keep it; user really likes how the in-game rune/spell system mirrors the emergent skill/merge hypothesis; wants spell-mixing-spells (use existing spells as ingredients too, procedural-but-semantic naming — R-v5.19).",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T21:07:17.787Z",
      "is_legacy": false,
      "is_empty": false
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [],
      "accuracy": null
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon-bare/template/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": {
      "filename": "find-sprites.md",
      "content": "---\nname: find-sprites\ndescription: Source visual assets (sprites, icons, tilesets, portraits) for a game or UI-heavy build in a way that yields a coherent, intentional look instead of a debug-console aesthetic. Use this skill when you need art for rooms, entities, UI controls, HP bars, spell icons, status effects, or any other visual element; when the build is failing its UI-quality gate because it looks unintentional; or when you're about to fall back to raw ASCII/text UI. The goal is \"looks like someone designed it\" — not photorealism, not 1:1 with AAA games, but internally consistent and readable.\n---\n\n# find-sprites\n\nAgents left to their own devices tend to ship raw text UI, emoji salad, or inconsistent asset mixtures. This skill exists because the `ui-quality` gate consistently fails when asset sourcing is treated as an afterthought. Source assets deliberately, in preference order, and commit to one visual direction.\n\n## Preference order\n\nWork down this list. Only drop to the next tier if the current tier cannot cover your need.\n\n### Tier 1 — Installable icon and sprite packages\n\nLightweight, well-typed, import cleanly. Best for UI iconography, status effects, resource icons, and action buttons.\n\n| Package | Use for |\n|---|---|\n| `lucide-react` / `lucide` | UI icons, buttons, controls, status (~1500 icons) |\n| `@iconify/react` / `@iconify-json/*` | Broadest set — game-icons pack, emojione, twemoji, etc. |\n| `@tabler/icons` | Clean outline style, good for minimalist UI |\n| `heroicons` | Simple outline + solid, Tailwind-friendly |\n\nFor game iconography specifically, **`@iconify-json/game-icons`** (Delapouite/Lorc) is the single highest-leverage install:\n\n```sh\nnpm install @iconify/react @iconify-json/game-icons\n```\n\n```tsx\nimport { Icon } from \"@iconify/react\";\n<Icon icon=\"game-icons:crossed-swords\" width={32} />\n<Icon icon=\"game-icons:fire-spell-cast\" width={32} />\n<Icon icon=\"game-icons:health-potion\" width={32} />\n```\n\n~4000 game-themed icons covering weapons, spells, monsters, resources, status effects. Use this before anything else for room icons, spell icons, enemy representations, and resource bars.\n\n### Tier 2 — Web-searched free/open-license art\n\nWhen you need actual sprites (not icons) — tilesets, character portraits, monster sprites, environment art.\n\n**Preferred sources** (all free, all permissively licensed — always confirm the specific asset's license before shipping):\n\n- **OpenGameArt.org** — CC0 / CC-BY tilesets, sprites, UI packs. Search \"dungeon tileset CC0\", \"roguelike monsters CC0\".\n- **Kenney.nl** — huge, consistent, CC0 asset packs. \"1-Bit Pack\", \"Roguelike/RPG Pack\", \"UI Pack\". Single-author → visual coherence is free.\n- **itch.io free assets** — filter by \"free\" and check each asset's license. Often CC0 or CC-BY.\n- **Game-icons.net** — the web source behind the Iconify pack above. SVG download if you need edits.\n\n**Process:**\n\n1. Pick ONE source pack for your core visual direction. Do not mix Kenney's 1-bit with Kenney's top-down pixel — pick one.\n2. Download the pack (or the specific sprites you need) into `game/public/assets/sprites/`.\n3. Record the source and license in `game/public/assets/LICENSES.md`:\n   ```\n   - dungeon-tileset/ — Kenney.nl \"Roguelike/RPG Pack\" — CC0\n   - monsters/ — OpenGameArt \"Pixel Monster Pack\" by <author> — CC-BY\n   ```\n4. Reference assets via static paths: `<img src=\"/assets/sprites/monsters/slime.png\" />`.\n\n### Tier 3 — Generated placeholder art\n\nWhen you cannot find a matching asset and time is short. Quality ranking:\n\n- **SVG drawn by hand** (inline or file) — scales, sharp, themeable via CSS.\n- **Canvas-drawn shapes** — works for simple top-down tiles, procedural dungeon cells.\n- **CSS-styled divs with gradients + borders** — good enough for room-type differentiation.\n- **Emoji fallback** — acceptable for status indicators and small UI accents only. Do NOT build your entire UI out of emoji — it reads as lazy even when consistent.\n\n### Tier 4 — Geometric primitives\n\nSolid-colored rectangles, circles, borders. **Counts against your UI-quality score even if used intentionally.** Only acceptable for background panels or temporary placeholders you will replace before shipping.\n\n### Tier 5 — Raw ASCII / text-only\n\nThis is a gate failure. Do not ship text-only UI. If you are tempted to, go back to Tier 1 and install the game-icons pack — it takes 30 seconds.\n\n## Coherence over polish\n\nOne consistent visual direction beats a mix of high-quality assets from different styles. A game built entirely from Kenney's 1-bit pack looks intentional. A game mixing hand-drawn portraits, pixel monsters, and flat-vector UI icons looks broken — even if each individual asset is beautiful.\n\nBefore sourcing anything, decide:\n\n1. **Perspective** — top-down, side-view, or UI-only?\n2. **Fidelity** — pixel, vector, or illustrated?\n3. **Palette** — dark fantasy, bright cartoon, monochrome?\n\nThen source only assets matching those three answers. If a must-have asset doesn't match, either adapt it (recolor, resize) or redraw the rest of your direction to match it.\n\n## Licensing\n\nAlways check the license. CC0 is the simplest — no attribution required, no restrictions. CC-BY requires attribution (include the author in `LICENSES.md`). Avoid CC-BY-NC (non-commercial) and CC-BY-SA (share-alike viral) unless you've confirmed your project's distribution model is compatible. Never ship assets of unknown provenance.\n\n## Failure modes\n\n- **Mixing styles.** Pixel + vector + illustrated = incoherent. Pick one.\n- **Installing an icon pack and never using it.** The install is the easy part. Actually replace placeholder text with `<Icon />` in every UI surface.\n- **Downloading a tileset without a license check.** Ship-blocker if the license forbids the use.\n- **Deferring art to \"after mechanics work.\"** The UI-quality gate is scored on what actually ships. An unpolished build with working mechanics still fails the gate.\n- **Using emoji as the entire UI.** Reads as a debugger, not a game.\n",
      "bytes": 6073,
      "total_skills": 2
    },
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": 0.25,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": null,
      "commit_discipline": null
    }
  },
  {
    "project": "escape-the-dungeon-emergent",
    "version": "v1",
    "workflow": "emergent",
    "requirementsVersion": "unknown",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 14,
      "phases_completed": 7,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 67375,
      "tool_uses": 79
    },
    "gitAnalysis": {
      "total_commits": 2,
      "task_id_commits": 0,
      "batch_commits": 2,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "Main menu renders, recognized saved game. But entering game gives error: 'Styled text error: unclosed tags START'. Cannot progress past main menu.",
      "fully_met": 2,
      "partially_met": 1,
      "not_met": 9,
      "coverage_ratio": 0.208
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": true,
      "emergence_score": 1
    },
    "planningQuality": null,
    "scores": {
      "requirement_coverage": 0.208,
      "workflow_quality": 0.6,
      "skill_reuse": 0.75,
      "implementation_quality": 0.1,
      "iteration_evidence": 0.14,
      "time_efficiency": 0.971,
      "human_review": 0.1,
      "composite": 0.303
    },
    "humanReview": {
      "score": 0.1,
      "notes": "Main menu renders and recognizes saved game state (improvement over bare v1). But game crashes with 'Styled text error: unclosed tags START' when entering gameplay. Cannot play. Score 0.10: better than blank screen, menu works, but game is broken.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.1,
          "notes": "Main menu renders and recognizes saved game state (improvement over bare v1). But game crashes with 'Styled text error: unclosed tags START' when entering gameplay. Cannot play. Score 0.10: better than blank screen, menu works, but game is broken."
        }
      },
      "aggregate_score": 0.1,
      "notes": "Main menu renders and recognizes saved game state (improvement over bare v1). But game crashes with 'Styled text error: unclosed tags START' when entering gameplay. Cannot play. Score 0.10: better than blank screen, menu works, but game is broken.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T03:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon-emergent/template/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.20299999999999999,
      "plan_adherence_delta": null,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 2,
      "commit_discipline": 0
    }
  },
  {
    "project": "escape-the-dungeon-emergent",
    "version": "v2",
    "workflow": "emergent",
    "requirementsVersion": "v3",
    "date": "2026-04-08",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "duration_minutes": 15,
      "phases_completed": 2,
      "tasks_completed": 0
    },
    "tokenUsage": {
      "total_tokens": 1609,
      "tool_uses": 73,
      "note": "rate-limited — but maintained phase commits"
    },
    "gitAnalysis": {
      "total_commits": 2,
      "task_id_commits": 0,
      "batch_commits": 0,
      "phase_commits": 2,
      "per_task_discipline": 0,
      "phase_discipline": 1
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": false,
      "gate_notes": "G1 (game-loop) partial — playable but no floor progression. G2 (spell-crafting) MET — forge added and functional, has authored content. G3 (ui-quality) medium — better than GAD, worse than bare v3.",
      "fully_met": 6,
      "partially_met": 4,
      "not_met": 2,
      "coverage_ratio": 0.667
    },
    "workflowEmergence": {
      "created_task_lists": true,
      "created_state_tracking": true,
      "created_architecture_docs": true,
      "created_reusable_skills": false,
      "emergence_score": 0.75
    },
    "planningQuality": null,
    "scores": {
      "requirement_coverage": 0.667,
      "workflow_quality": 0.75,
      "skill_reuse": 0.3,
      "implementation_quality": 0.6,
      "iteration_evidence": 0.5,
      "time_efficiency": 0.969,
      "human_review": 0.5,
      "composite": 0.478
    },
    "humanReview": {
      "score": 0.5,
      "notes": "Solid crafting system — forge functional with more authored content than other runs. Playable but no floor progression after boss. No way to train or test crafted spells. Maintained 2 phase commits even under rate limit pressure (the only condition that did). UI is medium quality — better than GAD v8, worse than bare v3. Score 0.50: most disciplined under pressure with functional crafting.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": 0.5,
          "notes": "Solid crafting system — forge functional with more authored content than other runs. Playable but no floor progression after boss. No way to train or test crafted spells. Maintained 2 phase commits even under rate limit pressure (the only condition that did). UI is medium quality — better than GAD v8, worse than bare v3. Score 0.50: most disciplined under pressure with functional crafting."
        }
      },
      "aggregate_score": 0.5,
      "notes": "Solid crafting system — forge functional with more authored content than other runs. Playable but no floor progression after boss. No way to train or test crafted spells. Maintained 2 phase commits even under rate limit pressure (the only condition that did). UI is medium quality — better than GAD v8, worse than bare v3. Score 0.50: most disciplined under pressure with functional crafting.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-08T06:00:00.000Z",
      "is_legacy": true,
      "is_empty": false
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.md (eval meta)",
      "path": "evals/escape-the-dungeon-emergent/REQUIREMENTS.md",
      "content": "# Eval: Escape the Dungeon (Emergent Methodology)\n\n## Purpose\n\nTests whether an agent's self-created development methodology improves over iterations.\nEach run inherits skills and workflow artifacts from the previous bare/emergent run.\nThe agent is NOT given the GAD framework — it uses whatever system it built last time,\nplus any improvements it wants to make.\n\n## Hypothesis\n\nAn agent that can read and build on its previous workflow and skills will produce\nprogressively better results across runs. If true, this validates the concept of\nemergent development methodology — the agent discovers effective patterns through\nexperience rather than being given them upfront.\n\n## How it works\n\n1. **v1**: Agent gets skills/workflow from `escape-the-dungeon-bare v1` (the first run)\n2. **v2**: Agent gets skills/workflow from emergent v1 (whatever it improved)\n3. **v3+**: Each run builds on the previous, accumulating and refining skills\n\nThe `skills/` directory in the template contains inherited artifacts. The agent is\ntold to read them, use what's useful, improve what's not, and add new skills when\nit encounters new patterns.\n\n## What this eval measures\n\n1. **Requirement coverage** (0.25) — same 12 criteria, same gate rules\n2. **Workflow quality** (0.15) — how well-structured is the tracking system?\n   - Clear phase breakdown? Task tracking? State management?\n3. **Skill reuse** (0.15) — did the agent actually USE inherited skills?\n   - Read them? Referenced them? Applied the patterns?\n   - Did it improve existing skills or just ignore them?\n4. **Implementation quality** (0.15) — build works, game runs, no critical bugs\n5. **Iteration evidence** (0.10) — did the agent update its workflow/skills during work?\n6. **Time efficiency** (0.05) — wall clock / tokens\n7. **Human review** (0.15) — playability, polish, code quality\n\n## Comparison across all three conditions\n\n| Condition | Framework | Skills | Tracking |\n|-----------|-----------|--------|----------|\n| GAD (escape-the-dungeon) | Full GAD framework | Pre-built skills | .planning/ XML |\n| Bare (escape-the-dungeon-bare) | None | Creates from scratch | Whatever agent makes |\n| Emergent (this eval) | None | Inherited from previous run | Evolves across runs |\n\nThe question: does emergent methodology converge toward GAD-level quality over iterations?\nAt what point does it plateau? Does it ever surpass GAD?\n\n## Game requirements\n\nSame REQUIREMENTS.xml as escape-the-dungeon and escape-the-dungeon-bare. Same 12 success\ncriteria, same gate rules, same vertical-slice priority.\n",
      "format": "md"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": 0.02200000000000002,
      "plan_adherence_delta": null,
      "produced_artifact_density": 0,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 2,
      "commit_discipline": 0
    }
  },
  {
    "project": "escape-the-dungeon-emergent",
    "version": "v3",
    "workflow": "emergent",
    "requirementsVersion": "v4",
    "date": "2026-04-09",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 4,
    "frameworkVersion": "1.32.0",
    "frameworkCommit": "3ef0bb5",
    "frameworkBranch": "main",
    "frameworkCommitTs": null,
    "frameworkStamp": "v1.32.0+3ef0bb5",
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-09T04:26:00.000Z",
      "ended": "2026-04-09T04:40:00.000Z",
      "duration_minutes": 14,
      "phases_completed": 0,
      "tasks_completed": 0,
      "rate_limited": true,
      "rate_limit_note": "Hit account-level rate limit at tool_uses=40 (lowest of three conditions). Shared rate bucket with parallel GAD + Bare runs."
    },
    "tokenUsage": {
      "total_tokens": 1008,
      "tool_uses": 40,
      "note": "rate-limited — did not reach build step"
    },
    "gitAnalysis": {
      "total_commits": 0,
      "task_id_commits": 0,
      "batch_commits": 0,
      "per_task_discipline": 0
    },
    "requirementCoverage": {
      "total_criteria": 12,
      "gate_failed": true,
      "gate_notes": "BUILD FAILS — main.ts entry point missing. index.html references /src/main.ts but only 6 supporting modules exist. Rollup error: 'failed to resolve import /src/main.ts'. All gates NOT MET because the build itself fails.",
      "fully_met": 0,
      "partially_met": 1,
      "not_met": 11,
      "coverage_ratio": 0.042
    },
    "workflowEmergence": {
      "created_task_lists": false,
      "created_state_tracking": false,
      "created_architecture_docs": false,
      "created_reusable_skills": false,
      "emergence_score": 0.4,
      "note": "Inherited 7 skills from previous runs. Wrote 6 modular source files (content, icons, renderer, state, styles, types) — the state-composition inherited skill shaped the architecture. Did NOT reach skill-authoring step."
    },
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0,
      "note": "No explicit planning artifact created beyond copying inherited skills."
    },
    "scores": {
      "requirement_coverage": 0.042,
      "planning_quality": 0.05,
      "per_task_discipline": 0,
      "skill_accuracy": null,
      "time_efficiency": 0.533,
      "human_review": null,
      "composite": null
    },
    "humanReview": {
      "score": null,
      "notes": "RATE LIMITED before main.ts entry point was written. Build fails objectively at link time. Architectural signal: emergent agent wrote 6 modular files before the integration layer, matching the state-composition inherited skill's pattern. Interesting emergence data point despite incomplete run. DO NOT include in cross-round comparisons against completed runs.",
      "reviewed_by": null,
      "reviewed_at": null
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": null,
          "notes": "RATE LIMITED before main.ts entry point was written. Build fails objectively at link time. Architectural signal: emergent agent wrote 6 modular files before the integration layer, matching the state-composition inherited skill's pattern. Interesting emergence data point despite incomplete run. DO NOT include in cross-round comparisons against completed runs."
        }
      },
      "aggregate_score": null,
      "notes": "RATE LIMITED before main.ts entry point was written. Build fails objectively at link time. Architectural signal: emergent agent wrote 6 modular files before the integration layer, matching the state-composition inherited skill's pattern. Interesting emergence data point despite incomplete run. DO NOT include in cross-round comparisons against completed runs.",
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon-emergent/template/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": {
      "filename": "find-sprites.md",
      "content": "---\nname: find-sprites\ndescription: Source visual assets (sprites, icons, tilesets, portraits) for a game or UI-heavy build in a way that yields a coherent, intentional look instead of a debug-console aesthetic. Use this skill when you need art for rooms, entities, UI controls, HP bars, spell icons, status effects, or any other visual element; when the build is failing its UI-quality gate because it looks unintentional; or when you're about to fall back to raw ASCII/text UI. The goal is \"looks like someone designed it\" — not photorealism, not 1:1 with AAA games, but internally consistent and readable.\n---\n\n# find-sprites\n\nAgents left to their own devices tend to ship raw text UI, emoji salad, or inconsistent asset mixtures. This skill exists because the `ui-quality` gate consistently fails when asset sourcing is treated as an afterthought. Source assets deliberately, in preference order, and commit to one visual direction.\n\n## Preference order\n\nWork down this list. Only drop to the next tier if the current tier cannot cover your need.\n\n### Tier 1 — Installable icon and sprite packages\n\nLightweight, well-typed, import cleanly. Best for UI iconography, status effects, resource icons, and action buttons.\n\n| Package | Use for |\n|---|---|\n| `lucide-react` / `lucide` | UI icons, buttons, controls, status (~1500 icons) |\n| `@iconify/react` / `@iconify-json/*` | Broadest set — game-icons pack, emojione, twemoji, etc. |\n| `@tabler/icons` | Clean outline style, good for minimalist UI |\n| `heroicons` | Simple outline + solid, Tailwind-friendly |\n\nFor game iconography specifically, **`@iconify-json/game-icons`** (Delapouite/Lorc) is the single highest-leverage install:\n\n```sh\nnpm install @iconify/react @iconify-json/game-icons\n```\n\n```tsx\nimport { Icon } from \"@iconify/react\";\n<Icon icon=\"game-icons:crossed-swords\" width={32} />\n<Icon icon=\"game-icons:fire-spell-cast\" width={32} />\n<Icon icon=\"game-icons:health-potion\" width={32} />\n```\n\n~4000 game-themed icons covering weapons, spells, monsters, resources, status effects. Use this before anything else for room icons, spell icons, enemy representations, and resource bars.\n\n### Tier 2 — Web-searched free/open-license art\n\nWhen you need actual sprites (not icons) — tilesets, character portraits, monster sprites, environment art.\n\n**Preferred sources** (all free, all permissively licensed — always confirm the specific asset's license before shipping):\n\n- **OpenGameArt.org** — CC0 / CC-BY tilesets, sprites, UI packs. Search \"dungeon tileset CC0\", \"roguelike monsters CC0\".\n- **Kenney.nl** — huge, consistent, CC0 asset packs. \"1-Bit Pack\", \"Roguelike/RPG Pack\", \"UI Pack\". Single-author → visual coherence is free.\n- **itch.io free assets** — filter by \"free\" and check each asset's license. Often CC0 or CC-BY.\n- **Game-icons.net** — the web source behind the Iconify pack above. SVG download if you need edits.\n\n**Process:**\n\n1. Pick ONE source pack for your core visual direction. Do not mix Kenney's 1-bit with Kenney's top-down pixel — pick one.\n2. Download the pack (or the specific sprites you need) into `game/public/assets/sprites/`.\n3. Record the source and license in `game/public/assets/LICENSES.md`:\n   ```\n   - dungeon-tileset/ — Kenney.nl \"Roguelike/RPG Pack\" — CC0\n   - monsters/ — OpenGameArt \"Pixel Monster Pack\" by <author> — CC-BY\n   ```\n4. Reference assets via static paths: `<img src=\"/assets/sprites/monsters/slime.png\" />`.\n\n### Tier 3 — Generated placeholder art\n\nWhen you cannot find a matching asset and time is short. Quality ranking:\n\n- **SVG drawn by hand** (inline or file) — scales, sharp, themeable via CSS.\n- **Canvas-drawn shapes** — works for simple top-down tiles, procedural dungeon cells.\n- **CSS-styled divs with gradients + borders** — good enough for room-type differentiation.\n- **Emoji fallback** — acceptable for status indicators and small UI accents only. Do NOT build your entire UI out of emoji — it reads as lazy even when consistent.\n\n### Tier 4 — Geometric primitives\n\nSolid-colored rectangles, circles, borders. **Counts against your UI-quality score even if used intentionally.** Only acceptable for background panels or temporary placeholders you will replace before shipping.\n\n### Tier 5 — Raw ASCII / text-only\n\nThis is a gate failure. Do not ship text-only UI. If you are tempted to, go back to Tier 1 and install the game-icons pack — it takes 30 seconds.\n\n## Coherence over polish\n\nOne consistent visual direction beats a mix of high-quality assets from different styles. A game built entirely from Kenney's 1-bit pack looks intentional. A game mixing hand-drawn portraits, pixel monsters, and flat-vector UI icons looks broken — even if each individual asset is beautiful.\n\nBefore sourcing anything, decide:\n\n1. **Perspective** — top-down, side-view, or UI-only?\n2. **Fidelity** — pixel, vector, or illustrated?\n3. **Palette** — dark fantasy, bright cartoon, monochrome?\n\nThen source only assets matching those three answers. If a must-have asset doesn't match, either adapt it (recolor, resize) or redraw the rest of your direction to match it.\n\n## Licensing\n\nAlways check the license. CC0 is the simplest — no attribution required, no restrictions. CC-BY requires attribution (include the author in `LICENSES.md`). Avoid CC-BY-NC (non-commercial) and CC-BY-SA (share-alike viral) unless you've confirmed your project's distribution model is compatible. Never ship assets of unknown provenance.\n\n## Failure modes\n\n- **Mixing styles.** Pixel + vector + illustrated = incoherent. Pick one.\n- **Installing an icon pack and never using it.** The install is the easy part. Actually replace placeholder text with `<Icon />` in every UI surface.\n- **Downloading a tileset without a license check.** Ship-blocker if the license forbids the use.\n- **Deferring art to \"after mechanics work.\"** The UI-quality gate is scored on what actually ships. An unpolished build with working mechanics still fails the gate.\n- **Using emoji as the entire UI.** Reads as a debugger, not a game.\n",
      "bytes": 6073,
      "total_skills": 7
    },
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": 0.5,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 0,
      "commit_discipline": null
    }
  },
  {
    "project": "escape-the-dungeon-emergent",
    "version": "v4",
    "workflow": "emergent",
    "requirementsVersion": "unknown",
    "date": "2026-04-09",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 4,
    "frameworkVersion": "1.32.0",
    "frameworkCommit": "459dc36",
    "frameworkBranch": "main",
    "frameworkCommitTs": "2026-04-09T00:22:35-05:00",
    "frameworkStamp": "v1.32.0+459dc36",
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-09T05:39:12.311Z",
      "ended": null,
      "duration_minutes": null,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "cli_efficiency": null,
      "skill_accuracy": null,
      "planning_quality": null,
      "time_efficiency": null,
      "composite": null,
      "human_review": 0.885
    },
    "humanReview": {
      "rubric_version": "v1",
      "dimensions": {
        "playability": {
          "score": 0.88,
          "notes": null
        },
        "ui_polish": {
          "score": 0.95,
          "notes": null
        },
        "mechanics_implementation": {
          "score": 0.9,
          "notes": null
        },
        "ingenuity_requirement_met": {
          "score": 0.95,
          "notes": null
        },
        "stability": {
          "score": 0.55,
          "notes": null
        },
        "skill_inheritance_effectiveness": {
          "score": 0.95,
          "notes": null
        }
      },
      "aggregate_score": 0.885,
      "notes": "REVISED UPWARD 2026-04-09 after user re-played and beat floor 1. Previous review incorrectly penalized playability for 'unbeatable boss'. Actual discovery: floor 1 IS beatable by skipping combat, gathering mana crystals, crafting the right spells, then fighting the warden fresh with stacked effects. User quote: 'fantastic representation of what a game should FEEL like.' The 'right answer exists and must be discovered' loop is precisely what v4 pressure requirements ask for, so ingenuity bumps 0.80 → 0.95. Playability 0.65 → 0.88 — the softlock feeling was user's learning curve, not a design failure. UI/mechanics/stability/skill-inheritance unchanged from first review. Stability 0.55 kept: notifications persisting across sessions and continue-after-death still broken (carried over to v5 addendum R-v5.09, R-v5.10). First observed full skill ratcheting cycle (authored dom-over-kaplay + pressure-forge-coupling + CHANGELOG) still stands.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T21:06:50.140Z"
    },
    "humanReviewNormalized": {
      "rubric_version": "v1",
      "dimensions": {
        "playability": {
          "score": 0.88,
          "notes": null
        },
        "ui_polish": {
          "score": 0.95,
          "notes": null
        },
        "mechanics_implementation": {
          "score": 0.9,
          "notes": null
        },
        "ingenuity_requirement_met": {
          "score": 0.95,
          "notes": null
        },
        "stability": {
          "score": 0.55,
          "notes": null
        },
        "skill_inheritance_effectiveness": {
          "score": 0.95,
          "notes": null
        }
      },
      "aggregate_score": 0.885,
      "notes": "REVISED UPWARD 2026-04-09 after user re-played and beat floor 1. Previous review incorrectly penalized playability for 'unbeatable boss'. Actual discovery: floor 1 IS beatable by skipping combat, gathering mana crystals, crafting the right spells, then fighting the warden fresh with stacked effects. User quote: 'fantastic representation of what a game should FEEL like.' The 'right answer exists and must be discovered' loop is precisely what v4 pressure requirements ask for, so ingenuity bumps 0.80 → 0.95. Playability 0.65 → 0.88 — the softlock feeling was user's learning curve, not a design failure. UI/mechanics/stability/skill-inheritance unchanged from first review. Stability 0.55 kept: notifications persisting across sessions and continue-after-death still broken (carried over to v5 addendum R-v5.09, R-v5.10). First observed full skill ratcheting cycle (authored dom-over-kaplay + pressure-forge-coupling + CHANGELOG) still stands.",
      "reviewed_by": "human",
      "reviewed_at": "2026-04-09T21:06:50.140Z",
      "is_legacy": false,
      "is_empty": false
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [],
      "accuracy": null
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/escape-the-dungeon-emergent/template/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<!--\r\n  Eval project: Escape the Dungeon\r\n  Requirements version history:\r\n    v1 (2026-04-06): 12 systems-focused criteria, no gates\r\n    v2 (2026-04-08): Gate criteria, vertical-slice priority, UI-first mandate\r\n    v3 (2026-04-08): Game-loop gate, spell-crafting gate, UI quality gate\r\n    v4 (2026-04-08): Pressure-oriented design, authored-only, ingenuity enforcement,\r\n                     floor progression with boss gates, forge integrated with encounter design,\r\n                     starter abilities explicitly insufficient, Traits UI label\r\n    v5 (2026-04-09): Playtest-driven expansion — 21 new/amended requirements from user\r\n                     play of Bare v5, Emergent v4, GAD v9/v10. Adds combat model choice\r\n                     (rule-based UO-style preferred), entity-trait action policies (enemies\r\n                     AND NPCs), real-time game-time, affinity reward loop, central visual\r\n                     nav map, encounter visuals, spells-as-ingredients, rune uniqueness,\r\n                     event-driven rendering, save checkpoints, merchants, NPC dialogue,\r\n                     inventory/equipment, character sheet + skill tree, loadout slots.\r\n                     v4 remains THE BASE — everything in v4 still applies. v5 adds on top.\r\n-->\r\n<requirements version=\"v5\" updated=\"2026-04-09\">\r\n  <goal>\r\n    Build a playable roguelike dungeon crawler \"Escape the Dungeon\" where players must\r\n    exercise INGENUITY through spell crafting and adaptation to progress. This is not a\r\n    features checklist — it is a problem-solving loop disguised as a dungeon crawler.\r\n    Every mechanical system must create friction that rewards creative player choice.\r\n  </goal>\r\n\r\n  <audience>Solo player (keyboard + mouse). Authored content only. Target: Vite + TypeScript + KAPLAY (web).</audience>\r\n\r\n  <core-principle>\r\n    **Baseline starter abilities must NOT be sufficient to comfortably complete a full\r\n    floor without adaptation or enhancement.** If a player can brute-force progression\r\n    using only what they start with, the design has failed. Encounters must demand\r\n    spell crafting, skill use, resource management, or build specialization.\r\n  </core-principle>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- GATE CRITERIA — all must pass or requirement_coverage = 0    -->\r\n  <!-- ============================================================ -->\r\n  <gate-criteria>\r\n\r\n    <gate id=\"G1\" name=\"game-loop\">\r\n      The complete game loop must work without softlock. A test run must walk through:\r\n      1. Title screen renders and \"New Game\" starts a run\r\n      2. Player enters first room with visible navigation options\r\n      3. Player navigates to a second room (scene transition succeeds)\r\n      4. Player encounters combat OR dialogue and resolves it\r\n      5. After resolution, player returns to room navigation state\r\n      6. Player continues into at least one additional room without softlock or dead end\r\n      Minimum 3 total room transitions in a passing run.\r\n    </gate>\r\n\r\n    <gate id=\"G2\" name=\"forge-with-ingenuity-payoff\">\r\n      The game must include a functional spell-crafting system AND at least one encounter\r\n      per floor where the crafted/adapted spell provides a meaningful advantage.\r\n\r\n      Crafting requirements:\r\n      - Player can access a forge / spell-craft interface during gameplay\r\n      - Player selects at least 2 crafting inputs (runes or components)\r\n      - System produces a new, usable spell from the combination\r\n      - Crafted spell can be equipped and used in encounter flow\r\n      - Minimum 3-5 runes/components, 3+ valid combinations\r\n\r\n      Ingenuity payoff requirement (THIS IS THE KEY ADDITION):\r\n      - At least one encounter per floor must significantly favor or require a crafted/\r\n        adapted spell. Examples: enemy resistant to base damage types, enemy that punishes\r\n        spell repetition, enemy that only yields to DoT or burst, etc.\r\n      - Mere spell acquisition through loot/NPC rewards does NOT satisfy this gate.\r\n      - Player must intentionally CRAFT to succeed.\r\n    </gate>\r\n\r\n    <gate id=\"G3\" name=\"ui-quality\">\r\n      The game must present a fully intentional UI. Required:\r\n      - Readable, visually structured layout with spacing and hierarchy\r\n      - Room-type icons or sprite representations\r\n      - Encounter/entity visual representation via sprite, portrait, or coherent placeholder\r\n      - Themed visual differentiation across room types (color, background, or panel treatment)\r\n      - Styled interactive controls (buttons with visible affordance)\r\n      - HP/mana/resources as visual bars, not only numeric dumps\r\n      - Color-coded statuses / spell types / factions\r\n\r\n      Acceptable asset sourcing (in order of preference):\r\n      1. Lightweight installable icon/sprite libraries (npm packages, CDN)\r\n      2. Web-searched free/open-license sprites and tilesets (use the find-sprites skill)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Simple geometric fallback tiles — LAST RESORT, counts against UI quality score\r\n\r\n      Raw ASCII/text-only UI fails this gate. Ugly primitive-only output counts as a gate\r\n      failure even if asset sourcing was attempted.\r\n    </gate>\r\n\r\n    <gate id=\"G4\" name=\"pressure-mechanics\">\r\n      The game must include at least TWO systems that constrain player behavior such that\r\n      crafting or adapting spells provides a meaningful advantage or is required for success.\r\n\r\n      Pick at least two from these categories:\r\n      A. **Resource pressure** — limited mana pool, limited healing, forge training has a cost,\r\n         cannot spam indefinitely\r\n      B. **Enemy counterplay** — resistances, immunities, behavior that punishes repetition,\r\n         shields requiring specific effects\r\n      C. **Encounter design pressure** — elites with unique rules, bosses that invalidate\r\n         default play, rooms with mechanical constraints\r\n      D. **Build pressure** — player cannot master everything, affinity pushes specialization,\r\n         loadout limits force trade-offs\r\n\r\n      At least one pressure mechanic must interact with the forge so crafted spells are\r\n      demonstrably more effective than default spells in affected encounters.\r\n    </gate>\r\n\r\n  </gate-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- DUNGEON STRUCTURE (authored, not procedural)                 -->\r\n  <!-- ============================================================ -->\r\n  <dungeon-structure>\r\n    <authored-only>\r\n      All content is authored. No procedural level generation. Light randomness in encounter\r\n      tables or loot is acceptable; structural layout must be hand-designed.\r\n    </authored-only>\r\n\r\n    <hierarchy>\r\n      Floors → Rooms → Boss Gate. Each floor has 5-8 authored rooms plus a floor boss that\r\n      gates progression to the next floor. Player clears a floor by defeating the boss,\r\n      which unlocks the next floor.\r\n    </hierarchy>\r\n\r\n    <room-types>\r\n      <type name=\"Combat\">Standard enemy encounter, authored enemy composition.</type>\r\n      <type name=\"Elite\">Stress test for a mechanic introduced earlier on this floor or a previous one. Harder than standard combat, usually requires crafted spells or adaptation.</type>\r\n      <type name=\"Forge\">Crafting + affinity training interface. May cost mana crystals or XP to use.</type>\r\n      <type name=\"Rest\">Limited recovery (heal HP/mana to a cap, NOT full restore every time).</type>\r\n      <type name=\"Event\">Choices, narrative, tradeoffs. May give items, information, or apply debuffs.</type>\r\n    </room-types>\r\n\r\n    <floor-mechanical-constraint>\r\n      Each floor MUST introduce at least one mechanical constraint or enemy behavior that\r\n      cannot be brute-forced with the player's current default abilities. Examples:\r\n      - Floor 1: enemies resistant to raw damage → player must apply DoT or status effects\r\n      - Floor 2: enemies that reflect direct damage → player must use indirect or summon-based attacks\r\n      - Floor 3: enemies with mana-drain aura → player must conserve or use physical skills\r\n      This constraint is discovered through gameplay, not explained in a tutorial.\r\n    </floor-mechanical-constraint>\r\n\r\n    <respawn-and-grinding>\r\n      Combat rooms on a cleared floor may respawn enemies on re-entry (respawn cadence is\r\n      authored, not every entry). Player can grind for XP, crystals, and rune affinity\r\n      before attempting bosses. Grinding should be slower than forge training to create\r\n      choice pressure.\r\n    </respawn-and-grinding>\r\n  </dungeon-structure>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- FORGE SYSTEM (now integrated with encounter design)          -->\r\n  <!-- ============================================================ -->\r\n  <forge-system>\r\n    <required>\r\n      - Forge interface accessible at Forge rooms\r\n      - 3-5 runes or crafting components\r\n      - 3+ valid combinations producing distinct spell effects\r\n      - Affinity tracking per rune/spell family, increases with use\r\n      - Forge can train affinity directly in exchange for XP (cheaper than combat grinding)\r\n      - At least one encounter per floor requires or strongly favors a crafted/adapted spell\r\n    </required>\r\n    <strongly-recommended>\r\n      - Visible affinity level (UI shows current levels)\r\n      - Affinity thresholds unlock stronger spell variants\r\n      - Authored or player-authored spell customization (player can name their spells)\r\n    </strongly-recommended>\r\n    <deferred-to-v5>\r\n      - Cross-affinity decay when runes are neglected\r\n      - Deep evolution trees\r\n      - Multi-stage spell mutations\r\n    </deferred-to-v5>\r\n  </forge-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SKILLS (scored, not gated)                                    -->\r\n  <!-- ============================================================ -->\r\n  <skills-system>\r\n    <required>\r\n      Combat must support at least one non-spell action category (basic attack, skill, or similar).\r\n      The combat model should NOT be single-lane \"spell or nothing\".\r\n    </required>\r\n    <scored>\r\n      Full skill system with physical (no-mana) actions, skill XP / evolution, mana-crystal\r\n      overcharge to add extra damage or effects (DoT, burn, bleed, stun, knockback).\r\n    </scored>\r\n  </skills-system>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- ASSET SOURCING (first attempt real assets)                   -->\r\n  <!-- ============================================================ -->\r\n  <asset-sourcing>\r\n    <workflow>\r\n      Agents must attempt asset sourcing first via the find-sprites skill or equivalent\r\n      web-search workflow. Sourced assets should be lightweight, installable, and legally\r\n      usable (open-license, public domain, or generated).\r\n    </workflow>\r\n    <preference-order>\r\n      1. Lightweight installable icon/sprite npm packages (game-icons, pixel-art packs)\r\n      2. Web-searched free/open-license sprites/tilesets (itch.io, OpenGameArt, etc.)\r\n      3. Generated placeholder art (canvas-drawn, SVG, emoji-based)\r\n      4. Geometric fallback tiles — LAST RESORT, counts against UI quality\r\n    </preference-order>\r\n    <fallback-policy>\r\n      Fallback to generated/geometric placeholders is allowed ONLY if sourcing genuinely\r\n      fails (404s, no suitable assets, integration cost disproportionate). Fallback must\r\n      still be visually coherent. Using fallback when real assets were reachable is a\r\n      gate violation.\r\n    </fallback-policy>\r\n  </asset-sourcing>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- TERMINOLOGY                                                   -->\r\n  <!-- ============================================================ -->\r\n  <terminology>\r\n    <ui-label>Traits — player-facing label for narrative/progression stats</ui-label>\r\n    <code-identifier>narrativeStats — internal code/data structure name</code-identifier>\r\n    <rationale>Splits stable internal naming from clearer external naming. Document the mapping once.</rationale>\r\n  </terminology>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- SCORED CRITERIA                                               -->\r\n  <!-- ============================================================ -->\r\n  <scored-criteria>\r\n    <criterion>Turn-based combat with Fight/Spells/Bag/Run, visible HP bars, damage numbers, XP/crystal rewards</criterion>\r\n    <criterion>At least 3 distinct enemy types with different stats and mechanical behaviors</criterion>\r\n    <criterion>NPC dialogue with portrait/representation and choice options that affect gameplay</criterion>\r\n    <criterion>Persistent HUD: player name, HP bar, mana bar, current floor, dungeon tick or turn count, crystal currency</criterion>\r\n    <criterion>At least two overlay menus (Map, Bag, Stats, Spellbook)</criterion>\r\n    <criterion>Entity model with at least 3 entity types loaded from content pack JSON</criterion>\r\n    <criterion>Game state persists across page refresh (localStorage)</criterion>\r\n    <criterion>Player can level up or gain power through gameplay progression</criterion>\r\n    <criterion>At least 2 floors with different mechanical constraints and boss encounters</criterion>\r\n    <criterion>\"Traits\" label used in UI where narrative stats appear</criterion>\r\n    <criterion>Full skill system with mana-crystal overcharge (scored bonus, not gate)</criterion>\r\n    <criterion>Affinity thresholds unlock spell variants (scored bonus, not gate)</criterion>\r\n  </scored-criteria>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- INGENUITY / ADAPTATION SCORING                                -->\r\n  <!-- ============================================================ -->\r\n  <ingenuity-scoring>\r\n    <dimension>ingenuity_score</dimension>\r\n    <measures>\r\n      Whether the player needed to change strategy, whether crafted spells were meaningfully\r\n      used, and whether encounters encouraged experimentation. Scored 0.0 to 1.0.\r\n    </measures>\r\n    <signals>\r\n      - Number of crafted spells actually used in a test run\r\n      - Diversity of spell usage (no single spell dominates)\r\n      - Can the starter spell alone clear every floor? (this should be NO)\r\n      - Does at least one encounter REQUIRE crafted spell usage to succeed?\r\n      - Did the test player adapt their build across floors?\r\n    </signals>\r\n    <scoring-notes>\r\n      This is measured via human review during playtesting. The reviewer asks: \"Did I feel\r\n      like I needed to craft to make progress, or could I spam the default spell?\"\r\n    </scoring-notes>\r\n  </ingenuity-scoring>\r\n\r\n  <non-goals>\r\n    <item>Procedural generation — authored content only</item>\r\n    <item>Full rune affinity decay — deferred to v5</item>\r\n    <item>Multi-stage deep evolution trees — deferred to v5</item>\r\n    <item>Tile-based movement or 2D grid walking</item>\r\n    <item>Multiplayer or networking</item>\r\n    <item>Complex asset pipelines or custom art tools</item>\r\n  </non-goals>\r\n\r\n  <source-docs>\r\n    <doc path=\"source-GAMEPLAY-DESIGN.xml\" role=\"Trimmed gameplay design (vertical slice focus)\" />\r\n    <doc path=\"source-STAT-AND-BEHAVIOUR-TAXONOMY.md\" role=\"Canonical stat names, groupings, engine mappings\" />\r\n  </source-docs>\r\n\r\n  <evaluation-notes>\r\n    Human reviewer rubric for ingenuity:\r\n    - 0.0: Could spam starter abilities to clear everything, no crafting needed\r\n    - 0.3: Had to use forge once, but mostly spammed\r\n    - 0.6: Had to craft 2-3 spells and switch strategies per floor\r\n    - 1.0: Had to think carefully about builds, crafted spells were essential, felt like a puzzle\r\n  </evaluation-notes>\r\n\r\n  <!-- ============================================================ -->\r\n  <!-- v5 ADDENDUM (2026-04-09) — playtest-driven                   -->\r\n  <!--                                                              -->\r\n  <!-- Captured from user play of Bare v5 (0.805 rubric), Emergent  -->\r\n  <!-- v4 (0.885 rubric after rescore), GAD v9 (rate-limited), GAD  -->\r\n  <!-- v10 (api-interrupted). Source markdown:                      -->\r\n  <!-- evals/_v5-requirements-addendum.md                           -->\r\n  <!--                                                              -->\r\n  <!-- Everything in v4 above still applies. v5 adds on top.        -->\r\n  <!-- ============================================================ -->\r\n  <addendum version=\"v5\" updated=\"2026-04-09\">\r\n\r\n    <requirement id=\"R-v5.01\" amends=\"G2\" title=\"Training via encounter, not menu\">\r\n      Affinity must increase as a side effect of casting spells in encounters, not as a\r\n      direct menu action. Remove any \"select affinity → train\" menu that picks the trained\r\n      element for the player. Introduce a Training Dummy encounter (low-XP, no-loot combat\r\n      room type) whose only purpose is letting the player cast without risk so affinity\r\n      rises through use. Any room with combat must produce affinity gain for the elements/\r\n      runes the cast spell used. The forge becomes a place to forge and combine, not to\r\n      train. Rationale: the casting of spells must be what increases rune affinity; direct\r\n      training menus turn a discovery loop into a shopping list.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.02\" title=\"Rune discovery as a gameplay loop\">\r\n      Not all runes are listed or available at game start. Runes must be DISCOVERED across\r\n      the dungeon. Starter inventory contains a small subset of runes (2-3). The rest are\r\n      found as loot drops from combat/elite encounters, hidden in event rooms, sold by\r\n      merchants, or awarded by NPC dialogue outcomes. The rune forge UI must visibly\r\n      distinguish known vs undiscovered runes (locked slots, ???, or similar). At least\r\n      one rune per floor must be gated behind a non-combat interaction.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.03\" title=\"Merchants with buy/sell/trade\">\r\n      The dungeon must contain at least one merchant encounter per floor. Merchant room\r\n      type. Inventory of runes, potions, and items with gold cost. Three operations: buy\r\n      (cost gold), sell (gain gold), trade (exchange owned item for stocked item with a\r\n      relative value rule). Gold or an equivalent currency becomes a tracked resource.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.04\" title=\"NPC dialogue with branching outcomes\">\r\n      Authored NPCs must appear with dialogue options that trigger items, events, or\r\n      combat. At least 3 authored NPCs across the dungeon with 2+ dialogue branches each.\r\n      Dialogue choices must cause persistent game state changes: item gain, rune unlock,\r\n      enemy spawn, merchant discount, quest flag.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.05\" title=\"Inventory/bag with grid and equippable items\">\r\n      Player must have a visible inventory UI. Bag with a finite grid of slots. Items have\r\n      categories: consumable (potions, keys), rune, equipment (weapon, armor, trinket,\r\n      focus, etc.). Equipment slots must exist on a character sheet with at least:\r\n      main-hand, off-hand, body, trinket. Equipping an item must affect combat stats or\r\n      spell outputs in a measurable way. Items must drop from combat, events, and\r\n      merchants.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.06\" title=\"Visible character sheet with combat/physical skills and a skill tree\">\r\n      Player must be able to inspect their character at any time. Panel showing: HP, mana,\r\n      affinities, physical/combat stats, resistances, equipped items, known spells, known\r\n      physical skills. Skill tree or equivalent progression graph for physical/combat\r\n      skills, SEPARATE FROM SPELLS. Physical skills cost stamina or a non-mana resource to\r\n      distinguish from spells.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.07\" title=\"Spell slots and skill slots (loadout constraint)\">\r\n      When the player has many spells/skills, they must choose which to equip. Fixed-size\r\n      spell loadout (suggested: 4-6 equipped slots out of all known spells). Fixed-size\r\n      physical skill loadout (suggested: 2-4 equipped slots). Loadout can only be changed\r\n      in rest rooms or at specific stations, not mid-combat. Build pressure mechanic\r\n      satisfying G4.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.08\" amends=\"G1\" title=\"Progression sources sufficient to reach end boss\">\r\n      Final-floor boss must be defeatable by a player who engaged with the intended loops.\r\n      There must be enough exp/mana/item sources along the path that a fully-crafted build\r\n      can overcome the warden-class boss. Respawning encounters on cleared floors must\r\n      give meaningful progression — not asymptotic crumbs that leave the player stuck. At\r\n      least one guaranteed mana-max or spell-power upgrade per floor (item, event reward,\r\n      merchant purchase). A pressure gate that is unwinnable is indistinguishable from a\r\n      softlock.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.09\" amends=\"G1\" title=\"Save checkpoints and continue after death\">\r\n      Death must not hard-brick the save. On new game, create a save slot and checkpoint\r\n      it on room-clear (or floor-clear at minimum). On death, \"Continue\" must load the\r\n      most recent checkpoint, not be greyed out. On manual exit from title screen,\r\n      re-entering must still offer Continue.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.10\" amends=\"G3\" title=\"Notification lifecycle\">\r\n      Toast/notification elements must auto-dismiss and must not persist across game\r\n      sessions. Every notification has a timeout (suggested: 3-5s) or explicit dismiss\r\n      control. Starting a new game must clear any in-flight notifications from the\r\n      previous session. Reloading the page must not restore stale notifications.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.11\" amends=\"room-types\" title=\"Rest rooms must offer rest\">\r\n      Any room typed Rest (including the rune forge rest variant) must expose a Rest\r\n      action that restores HP/mana and allows loadout changes. Forge rooms may combine\r\n      Forge + Train + Rest actions, but Rest must be one of the action buttons if the room\r\n      claims Rest as a room type.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.12\" amends=\"G3\" title=\"Navigation and map usability\">\r\n      Map/navigation UI must be more than a linear list. Map view must show at minimum a\r\n      2D graph layout of discovered rooms with current position, cleared/uncleared state,\r\n      and available exits. Navigation from the map must be one click, not a multi-step\r\n      menu. See R-v5.17 for the stronger form.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.13\" amends=\"G1 G4\" title=\"Combat model must be explicitly chosen — Model A preferred\">\r\n      The combat system must be one of two named models, chosen and documented before\r\n      implementation. Model A (RULE-BASED SIMULATION, Unicorn-Overlord-style, PREFERRED):\r\n      encounters simulated from loadout + spells + skills + stats + traits; board\r\n      positioning on a chess-like grid; action policies per entity driven by traits;\r\n      initiative turn order derived from stats + policy, not menu selection; player input\r\n      is loadout + policies + positioning; combat resolves automatically with clear log.\r\n      Model B (direct-control) is simpler but caps ingenuity. v5 PICKS MODEL A unless an\r\n      implementation exception is granted.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.14\" title=\"Action policies driven by entity traits (enemies AND NPCs)\">\r\n      Every entity with agency has an action-policy block keyed to its traits. Enemies:\r\n      aggressive → attack; territorial → hold position; etc. NPCs get action policies too\r\n      — dialogue options and behavior change as their traits (or the player's traits)\r\n      shift. Example: a greedy merchant charges 20% more when player is famous; a\r\n      scholarly NPC reveals rune lore only if player affinity.arcane &gt; 0.5. Dialogue\r\n      must become more prevalent overall — NPC interaction is a first-class gameplay loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.15\" title=\"Real-time game-time model (remove tick system)\">\r\n      Game time progresses in real time with a fixed real-to-game ratio. Default:\r\n      1 real hour = 1 in-game day. Remove any per-tick redraw loop. Use event-driven\r\n      updates only. Day/night cycle exists as game state and can drive encounter tables,\r\n      merchant stock, NPC availability. UI time-of-day shading is a SOFT requirement —\r\n      bonus scored dimension, not gate — if performant, the UI tints shift across in-game\r\n      day phases.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.16\" title=\"Affinity reward loop\">\r\n      Boosting a rune's affinity must produce a visible, valuable reward — not just a\r\n      stat increment hidden on a sheet. Suggested rewards at affinity thresholds: new\r\n      rune variant unlocked, existing spells using that rune gain a visual effect tier,\r\n      new spell combinations become craftable, access to an affinity-gated event or NPC.\r\n      At least one affinity reward must be visible in the forge UI (e.g. an affinity\r\n      progress bar with named milestones).\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.17\" amends=\"G3 R-v5.12\" title=\"Central visual navigation map with player location\">\r\n      Stronger form of R-v5.12. The navigation view must be a persistent, reachable,\r\n      visual map. Accessible from a single button/keystroke at any time in exploration\r\n      mode. Shows the player token on its current room, room type icons, discovered vs\r\n      undiscovered rooms, cleared vs active rooms, and visible exit connections between\r\n      rooms. Clicking an adjacent room must move the player there in one action.\r\n      Preferred layout: 2D grid or spatial floor map.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.18\" title=\"Visual player vs enemy identity in encounters\">\r\n      Encounter rendering must make it obvious which visual element is the player and\r\n      which is the enemy. Distinct portrait, positioning, or color treatment. Reference\r\n      style: Pokemon or Unicorn Overlord (UO preferred). No rendering where the player\r\n      cannot visually distinguish themselves from the first enemy without reading text\r\n      labels.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.19\" title=\"Spells as craftable ingredients + procedural-but-semantic naming\">\r\n      Spell crafting accepts runes AND existing spells as ingredients. A spell used as an\r\n      ingredient consumes or copies from the existing spell (design choice explicit).\r\n      Combining two spells or a spell + rune produces an evolved spell with procedurally\r\n      generated but semantically meaningful naming. Naming scheme must be consistent but\r\n      varied — similar combinations produce similar names, slight differences produce\r\n      slightly varied names. Not too verbose. Example scheme: root spell + modifier noun\r\n      keyed to added element/spell. \"Fireball\" + Ice rune → \"Frostfall Ember\". Two\r\n      Frostfall Embers fused → \"Glacial Ember\" (same family, progressed). This requirement\r\n      mirrors the emergent-evolution working hypothesis (gad-68): the in-game rune/spell/\r\n      merge system is an explicit narrative analogue for the agent's skill-authoring/merge\r\n      loop.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.20\" title=\"Rune uniqueness within a single spell (bug fix)\">\r\n      A spell may not include the same rune twice in its ingredient list. Selecting rune X,\r\n      then rune X again for the same spell must be rejected or de-selected. The same rune\r\n      CAN appear across DIFFERENT spells in the player's spellbook — the constraint is\r\n      per-spell, not per-player. Affinity gain must be calculated based on unique rune\r\n      slots actually consumed. Observed bug (Bare v5): crafting with the same rune twice\r\n      doubled that rune's affinity gain. Logged in data/bugs.json.\r\n    </requirement>\r\n\r\n    <requirement id=\"R-v5.21\" title=\"Event-driven rendering (remove per-tick redraws)\">\r\n      All UI updates must be event-driven, not per-tick. No redraw loops firing at a\r\n      fixed rate regardless of state changes. Observable symptom to eliminate: glitchy\r\n      redraws on button clicks, observed across ALL round-4 builds. This is a\r\n      perf-and-stability gate failure mode. Acceptable patterns: React reconciliation on\r\n      state change, requestAnimationFrame scheduling only when animation is active.\r\n    </requirement>\r\n\r\n    <gate-impact-summary>\r\n      v4 gates remain (G1 game-loop, G2 forge-with-ingenuity-payoff, G3 ui-quality,\r\n      G4 pressure-mechanics). v5 amendments tighten G1 (death/continue, end-boss reachable),\r\n      G2 (training is encounter-driven), G3 (notification lifecycle, map usability), and\r\n      introduce new scored dimensions for inventory_and_equipment_present and\r\n      npc_dialogue_present rather than new gates — a run missing those does not get\r\n      gate-zeroed but takes a meaningful scored hit.\r\n    </gate-impact-summary>\r\n\r\n    <deferred-to-v6>\r\n      <item>Deep evolution trees (multi-stage mutations).</item>\r\n      <item>Rune affinity decay when unused.</item>\r\n      <item>Multi-character party play — out of scope for escape-the-dungeon family.</item>\r\n    </deferred-to-v6>\r\n\r\n  </addendum>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": {
      "filename": "find-sprites.md",
      "content": "---\nname: find-sprites\ndescription: Source visual assets (sprites, icons, tilesets, portraits) for a game or UI-heavy build in a way that yields a coherent, intentional look instead of a debug-console aesthetic. Use this skill when you need art for rooms, entities, UI controls, HP bars, spell icons, status effects, or any other visual element; when the build is failing its UI-quality gate because it looks unintentional; or when you're about to fall back to raw ASCII/text UI. The goal is \"looks like someone designed it\" — not photorealism, not 1:1 with AAA games, but internally consistent and readable.\n---\n\n# find-sprites\n\nAgents left to their own devices tend to ship raw text UI, emoji salad, or inconsistent asset mixtures. This skill exists because the `ui-quality` gate consistently fails when asset sourcing is treated as an afterthought. Source assets deliberately, in preference order, and commit to one visual direction.\n\n## Preference order\n\nWork down this list. Only drop to the next tier if the current tier cannot cover your need.\n\n### Tier 1 — Installable icon and sprite packages\n\nLightweight, well-typed, import cleanly. Best for UI iconography, status effects, resource icons, and action buttons.\n\n| Package | Use for |\n|---|---|\n| `lucide-react` / `lucide` | UI icons, buttons, controls, status (~1500 icons) |\n| `@iconify/react` / `@iconify-json/*` | Broadest set — game-icons pack, emojione, twemoji, etc. |\n| `@tabler/icons` | Clean outline style, good for minimalist UI |\n| `heroicons` | Simple outline + solid, Tailwind-friendly |\n\nFor game iconography specifically, **`@iconify-json/game-icons`** (Delapouite/Lorc) is the single highest-leverage install:\n\n```sh\nnpm install @iconify/react @iconify-json/game-icons\n```\n\n```tsx\nimport { Icon } from \"@iconify/react\";\n<Icon icon=\"game-icons:crossed-swords\" width={32} />\n<Icon icon=\"game-icons:fire-spell-cast\" width={32} />\n<Icon icon=\"game-icons:health-potion\" width={32} />\n```\n\n~4000 game-themed icons covering weapons, spells, monsters, resources, status effects. Use this before anything else for room icons, spell icons, enemy representations, and resource bars.\n\n### Tier 2 — Web-searched free/open-license art\n\nWhen you need actual sprites (not icons) — tilesets, character portraits, monster sprites, environment art.\n\n**Preferred sources** (all free, all permissively licensed — always confirm the specific asset's license before shipping):\n\n- **OpenGameArt.org** — CC0 / CC-BY tilesets, sprites, UI packs. Search \"dungeon tileset CC0\", \"roguelike monsters CC0\".\n- **Kenney.nl** — huge, consistent, CC0 asset packs. \"1-Bit Pack\", \"Roguelike/RPG Pack\", \"UI Pack\". Single-author → visual coherence is free.\n- **itch.io free assets** — filter by \"free\" and check each asset's license. Often CC0 or CC-BY.\n- **Game-icons.net** — the web source behind the Iconify pack above. SVG download if you need edits.\n\n**Process:**\n\n1. Pick ONE source pack for your core visual direction. Do not mix Kenney's 1-bit with Kenney's top-down pixel — pick one.\n2. Download the pack (or the specific sprites you need) into `game/public/assets/sprites/`.\n3. Record the source and license in `game/public/assets/LICENSES.md`:\n   ```\n   - dungeon-tileset/ — Kenney.nl \"Roguelike/RPG Pack\" — CC0\n   - monsters/ — OpenGameArt \"Pixel Monster Pack\" by <author> — CC-BY\n   ```\n4. Reference assets via static paths: `<img src=\"/assets/sprites/monsters/slime.png\" />`.\n\n### Tier 3 — Generated placeholder art\n\nWhen you cannot find a matching asset and time is short. Quality ranking:\n\n- **SVG drawn by hand** (inline or file) — scales, sharp, themeable via CSS.\n- **Canvas-drawn shapes** — works for simple top-down tiles, procedural dungeon cells.\n- **CSS-styled divs with gradients + borders** — good enough for room-type differentiation.\n- **Emoji fallback** — acceptable for status indicators and small UI accents only. Do NOT build your entire UI out of emoji — it reads as lazy even when consistent.\n\n### Tier 4 — Geometric primitives\n\nSolid-colored rectangles, circles, borders. **Counts against your UI-quality score even if used intentionally.** Only acceptable for background panels or temporary placeholders you will replace before shipping.\n\n### Tier 5 — Raw ASCII / text-only\n\nThis is a gate failure. Do not ship text-only UI. If you are tempted to, go back to Tier 1 and install the game-icons pack — it takes 30 seconds.\n\n## Coherence over polish\n\nOne consistent visual direction beats a mix of high-quality assets from different styles. A game built entirely from Kenney's 1-bit pack looks intentional. A game mixing hand-drawn portraits, pixel monsters, and flat-vector UI icons looks broken — even if each individual asset is beautiful.\n\nBefore sourcing anything, decide:\n\n1. **Perspective** — top-down, side-view, or UI-only?\n2. **Fidelity** — pixel, vector, or illustrated?\n3. **Palette** — dark fantasy, bright cartoon, monochrome?\n\nThen source only assets matching those three answers. If a must-have asset doesn't match, either adapt it (recolor, resize) or redraw the rest of your direction to match it.\n\n## Licensing\n\nAlways check the license. CC0 is the simplest — no attribution required, no restrictions. CC-BY requires attribution (include the author in `LICENSES.md`). Avoid CC-BY-NC (non-commercial) and CC-BY-SA (share-alike viral) unless you've confirmed your project's distribution model is compatible. Never ship assets of unknown provenance.\n\n## Failure modes\n\n- **Mixing styles.** Pixel + vector + illustrated = incoherent. Pick one.\n- **Installing an icon pack and never using it.** The install is the easy part. Actually replace placeholder text with `<Icon />` in every UI surface.\n- **Downloading a tileset without a license check.** Ship-blocker if the license forbids the use.\n- **Deferring art to \"after mechanics work.\"** The UI-quality gate is scored on what actually ships. An unpolished build with working mechanics still fails the gate.\n- **Using emoji as the entire UI.** Reads as a debugger, not a game.\n",
      "bytes": 6073,
      "total_skills": 10
    },
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": null,
      "commit_discipline": null
    }
  },
  {
    "project": "planning-migration",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": null,
    "gadVersion": null,
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": null,
    "timing": null,
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": null,
    "scores": {
      "composite": 0.978
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": null,
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": null,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": null,
      "commit_discipline": null
    }
  },
  {
    "project": "portfolio-bare",
    "version": "v2",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T01:33:56.211Z",
      "ended": null,
      "duration_minutes": null,
      "phases_completed": 0,
      "tasks_completed": 0
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 0,
      "tasks_planned": 0,
      "tasks_completed": 0,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 0,
      "state_stale_count": 0
    },
    "scores": {
      "cli_efficiency": null,
      "skill_accuracy": null,
      "planning_quality": null,
      "time_efficiency": null,
      "composite": null
    },
    "humanReview": {
      "score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null
    },
    "humanReviewNormalized": {
      "rubric_version": "legacy-v0",
      "dimensions": {
        "overall": {
          "score": null,
          "notes": null
        }
      },
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [],
      "accuracy": null
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.md (eval meta)",
      "path": "evals/portfolio-bare/REQUIREMENTS.md",
      "content": "# Eval: portfolio-bare\n\n**Project:** Custom Portfolio (MagicbornStudios)\n**Source:** Stripped from portfolio's `.planning/` planning state and requirements\n\n## Goal\n\nValidate that a GAD agent can correctly plan and execute phases for the portfolio\nmonorepo given only a bare requirements spec. This eval measures:\n\n1. **Plan accuracy** — does the agent's phase plan match the human-authored plan?\n2. **Execution fidelity** — do agent-executed tasks produce the expected outputs?\n3. **State hygiene** — does STATE.md stay clean and accurate after each phase?\n4. **Token efficiency** — total tokens consumed vs. baseline human-guided run\n\n## Requirements\n\n### Project type\nTurborepo monorepo with Next.js portfolio app, content docs, vendor submodules.\n\n### Stack\n- Next.js 15, React, TypeScript, Tailwind CSS\n- Payload CMS for content\n- pnpm workspaces\n- Vercel deployment\n\n### Active milestone\nM2: GAD Foundation — make GAD self-contained, monorepo-aware, eval-capable.\n\n### Phase sequence expected\n1. Install/dependency layer (GAD package.json, install.js)\n2. Command prefix rename (gsd: → gad:)\n3. planning-config.toml support\n4. Net-new CLI commands (workspace sync/add, docs compile, migrate-schema, eval)\n5. README + CHANGELOG\n\n## Success criteria\n\n| Criterion | Pass threshold |\n|-----------|----------------|\n| Phase plan matches | ≥ 80% structural overlap with reference plan |\n| All tasks executed | 100% (no silent skips) |\n| STATE.md valid | Parses correctly after each phase |\n| Tokens per phase | ≤ 1.2× baseline |\n\n## Baseline\n\nRun against HEAD of `MagicbornStudios/get-anything-done` at the start of M2.\n\n## Notes\n\n- The portfolio's actual `planning-config.toml` is the canonical config input\n- Strip all existing PLAN.md/SUMMARY.md files before each run (bare start)\n- Agent should produce equivalent planning docs from requirements alone\n",
      "format": "md"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": null,
      "commit_discipline": null
    }
  },
  {
    "project": "portfolio-bare",
    "version": "v3",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T03:42:00.000Z",
      "ended": "2026-04-07T04:06:00.000Z",
      "duration_minutes": 24,
      "phases_completed": 5,
      "tasks_completed": 12
    },
    "tokenUsage": {
      "total_tokens": 90181,
      "tool_uses": 140
    },
    "gitAnalysis": {
      "total_commits": 13,
      "task_id_commits": 12,
      "batch_commits": 1,
      "source_files_created": 15,
      "state_updates": 12,
      "decisions_added": 0,
      "per_task_discipline": 1
    },
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 5,
      "tasks_planned": 12,
      "tasks_completed": 12,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 12,
      "state_stale_count": 0
    },
    "scores": {
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.95,
      "per_task_discipline": 1,
      "composite": 0.944
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.md (eval meta)",
      "path": "evals/portfolio-bare/REQUIREMENTS.md",
      "content": "# Eval: portfolio-bare\n\n**Project:** Custom Portfolio (MagicbornStudios)\n**Source:** Stripped from portfolio's `.planning/` planning state and requirements\n\n## Goal\n\nValidate that a GAD agent can correctly plan and execute phases for the portfolio\nmonorepo given only a bare requirements spec. This eval measures:\n\n1. **Plan accuracy** — does the agent's phase plan match the human-authored plan?\n2. **Execution fidelity** — do agent-executed tasks produce the expected outputs?\n3. **State hygiene** — does STATE.md stay clean and accurate after each phase?\n4. **Token efficiency** — total tokens consumed vs. baseline human-guided run\n\n## Requirements\n\n### Project type\nTurborepo monorepo with Next.js portfolio app, content docs, vendor submodules.\n\n### Stack\n- Next.js 15, React, TypeScript, Tailwind CSS\n- Payload CMS for content\n- pnpm workspaces\n- Vercel deployment\n\n### Active milestone\nM2: GAD Foundation — make GAD self-contained, monorepo-aware, eval-capable.\n\n### Phase sequence expected\n1. Install/dependency layer (GAD package.json, install.js)\n2. Command prefix rename (gsd: → gad:)\n3. planning-config.toml support\n4. Net-new CLI commands (workspace sync/add, docs compile, migrate-schema, eval)\n5. README + CHANGELOG\n\n## Success criteria\n\n| Criterion | Pass threshold |\n|-----------|----------------|\n| Phase plan matches | ≥ 80% structural overlap with reference plan |\n| All tasks executed | 100% (no silent skips) |\n| STATE.md valid | Parses correctly after each phase |\n| Tokens per phase | ≤ 1.2× baseline |\n\n## Baseline\n\nRun against HEAD of `MagicbornStudios/get-anything-done` at the start of M2.\n\n## Notes\n\n- The portfolio's actual `planning-config.toml` is the canonical config input\n- Strip all existing PLAN.md/SUMMARY.md files before each run (bare start)\n- Agent should produce equivalent planning docs from requirements alone\n",
      "format": "md"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 13,
      "commit_discipline": 0.9230769230769231
    }
  },
  {
    "project": "portfolio-bare",
    "version": "v4",
    "workflow": "bare",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T07:00:00.000Z",
      "ended": "2026-04-07T07:12:00.000Z",
      "duration_minutes": 12,
      "phases_completed": 5,
      "tasks_completed": 12
    },
    "tokenUsage": {
      "total_tokens": 78550,
      "tool_uses": 119
    },
    "gitAnalysis": {
      "total_commits": 19,
      "task_id_commits": 12,
      "batch_commits": 0,
      "source_files_created": 15,
      "state_updates": 12,
      "decisions_added": 3,
      "per_task_discipline": 1,
      "verify_commits": 5,
      "conventions_created": true
    },
    "requirementCoverage": {
      "total_criteria": 4,
      "fully_met": 4,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 5,
      "tasks_planned": 13,
      "tasks_completed": 13,
      "tasks_blocked": 0,
      "decisions_captured": 3,
      "state_updates": 12,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 1,
      "time_efficiency": 0.975,
      "per_task_discipline": 1,
      "composite": 0.996,
      "human_review": null,
      "auto_composite": 0.996
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [
        {
          "skill": "/gad:plan-phase",
          "when": "before implementation",
          "triggered": true
        },
        {
          "skill": "/gad:execute-phase",
          "when": "per phase",
          "triggered": true
        },
        {
          "skill": "/gad:task-checkpoint",
          "when": "between tasks",
          "triggered": true
        },
        {
          "skill": "/gad:auto-conventions",
          "when": "after first code phase",
          "triggered": true
        },
        {
          "skill": "/gad:verify-work",
          "when": "after phase completion",
          "triggered": true
        },
        {
          "skill": "/gad:check-todos",
          "when": "session start",
          "triggered": true
        }
      ],
      "accuracy": 1
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.md (eval meta)",
      "path": "evals/portfolio-bare/REQUIREMENTS.md",
      "content": "# Eval: portfolio-bare\n\n**Project:** Custom Portfolio (MagicbornStudios)\n**Source:** Stripped from portfolio's `.planning/` planning state and requirements\n\n## Goal\n\nValidate that a GAD agent can correctly plan and execute phases for the portfolio\nmonorepo given only a bare requirements spec. This eval measures:\n\n1. **Plan accuracy** — does the agent's phase plan match the human-authored plan?\n2. **Execution fidelity** — do agent-executed tasks produce the expected outputs?\n3. **State hygiene** — does STATE.md stay clean and accurate after each phase?\n4. **Token efficiency** — total tokens consumed vs. baseline human-guided run\n\n## Requirements\n\n### Project type\nTurborepo monorepo with Next.js portfolio app, content docs, vendor submodules.\n\n### Stack\n- Next.js 15, React, TypeScript, Tailwind CSS\n- Payload CMS for content\n- pnpm workspaces\n- Vercel deployment\n\n### Active milestone\nM2: GAD Foundation — make GAD self-contained, monorepo-aware, eval-capable.\n\n### Phase sequence expected\n1. Install/dependency layer (GAD package.json, install.js)\n2. Command prefix rename (gsd: → gad:)\n3. planning-config.toml support\n4. Net-new CLI commands (workspace sync/add, docs compile, migrate-schema, eval)\n5. README + CHANGELOG\n\n## Success criteria\n\n| Criterion | Pass threshold |\n|-----------|----------------|\n| Phase plan matches | ≥ 80% structural overlap with reference plan |\n| All tasks executed | 100% (no silent skips) |\n| STATE.md valid | Parses correctly after each phase |\n| Tokens per phase | ≤ 1.2× baseline |\n\n## Baseline\n\nRun against HEAD of `MagicbornStudios/get-anything-done` at the start of M2.\n\n## Notes\n\n- The portfolio's actual `planning-config.toml` is the canonical config input\n- Strip all existing PLAN.md/SUMMARY.md files before each run (bare start)\n- Agent should produce equivalent planning docs from requirements alone\n",
      "format": "md"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 19,
      "commit_discipline": 0.631578947368421
    }
  },
  {
    "project": "project-migration",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-04",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 2,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "phases_completed": 1,
      "tasks_completed": 8
    },
    "tokenUsage": null,
    "gitAnalysis": null,
    "requirementCoverage": null,
    "workflowEmergence": null,
    "planningQuality": {
      "tasks_completed": 8,
      "tasks_total": 8
    },
    "scores": {
      "planning_continuity": 0.9,
      "skill_coverage": 0.95,
      "context_efficiency": 0.85,
      "docs_sink_alignment": 0.8,
      "composite": 0.89
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.md (eval meta)",
      "path": "evals/project-migration/REQUIREMENTS.md",
      "content": "# Requirements: Project Migration Eval\n\n## Goal\n\nMeasure the quality and completeness of migrating a project from a legacy planning framework (RepoPlanner XML-based) to GAD. This eval documents the repeatable migration pattern so it can be applied across all projects in the monorepo.\n\n## What \"migrated\" means\n\nA project is fully migrated when:\n\n1. **Registered as a GAD root** — entry in `planning-config.toml` `[[planning.roots]]`\n2. **GAD planning files present** — `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/AGENTS.md`\n3. **`gad state` returns clean data** — no \"—\" for milestone, status, or phase\n4. **`gad phases` returns correct done/active** — phases match actual completion state\n5. **`gad tasks` works** — returns tasks from TASK-REGISTRY.xml or STATE.md tables\n6. **Skills migrated** — rp-* skills replaced by gad:* equivalents; no orphaned methodology\n7. **Docs sink aligned** — portfolio planning docs reference the GAD project, not legacy XML paths\n8. **No planning drift** — legacy session.md replaced by gad session\n\n## Metrics\n\n| Metric | Definition |\n|--------|------------|\n| planning_continuity | All planning state preserved across migration (phase history, decisions, tasks) |\n| skill_coverage | Every rp-* skill has a gad:* equivalent; no methodology lost |\n| context_efficiency | `gad state` + `gad context` returns useful output for this project (no \"—\" fields) |\n| docs_sink_alignment | Portfolio docs still accurately describe the project after migration |\n\n## Scoring per metric\n\n**planning_continuity (0–1):**\n- 1.0: All phases, tasks, decisions, and errors-and-attempts preserved\n- 0.8: Phases + tasks preserved; decisions moved without loss\n- 0.6: Phases preserved; tasks partially migrated\n- <0.6: Data loss\n\n**skill_coverage (0–1):**\n- 1.0: All rp-* skills have documented gad:* equivalents; manuscript migrated\n- 0.8: Core workflow skills migrated (execute, plan, verify, session)\n- 0.5: Partial migration; some skills still only rp-* with no gad equivalent\n\n**context_efficiency (0–1):**\n- 1.0: `gad state` returns phase, milestone, status, open_tasks, last_activity, next_action\n- 0.8: Phase, milestone, status present; minor gaps\n- <0.6: Major gaps (\"—\" on critical fields)\n\n**docs_sink_alignment (0–1):**\n- 1.0: Sink docs reference GAD project; state in sink matches STATE.md\n- 0.8: Sink docs exist but not updated for GAD migration phase\n- 0.5: Sink docs stale (refer to legacy XML paths or old status)\n\n## Success criteria\n\n- All four metrics >= 0.80\n- Composite score >= 0.85\n- `gad projects list` shows the project\n- No rp-* skills without a corresponding gad:* stub\n\n## Baseline project: repo-planner\n\nThe first migration documented in this eval is `vendor/repo-planner`. Run the measurement after migration completes to establish the v1 baseline.\n\n## Repeatable pattern checklist\n\nFor each new project migration:\n- [ ] Add `[[planning.roots]]` entry to `planning-config.toml`\n- [ ] Create `.planning/ROADMAP.md` (checklist format)\n- [ ] Create `.planning/STATE.md` (plain key-value, not table format)\n- [ ] Create `.planning/AGENTS.md` (GAD context re-hydration + docs sink reference)\n- [ ] Run `gad state --projectid <id>` — verify no \"—\" on critical fields\n- [ ] Run `gad phases --projectid <id>` — verify done/active correct\n- [ ] Update docs sink state file with GAD migration phase status\n- [ ] Replace any legacy skill stubs with gad:* redirects\n",
      "format": "md"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": null,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": null,
      "commit_discipline": null
    }
  },
  {
    "project": "reader-workspace",
    "version": "v1",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T02:36:00.000Z",
      "ended": "2026-04-07T02:49:30.000Z",
      "duration_minutes": 13,
      "phases_completed": 12,
      "tasks_completed": 24
    },
    "tokenUsage": {
      "total_tokens": 89372,
      "tool_uses": 105
    },
    "gitAnalysis": {
      "total_commits": 12,
      "task_id_commits": 12,
      "batch_commits": 0,
      "source_files_created": 34,
      "state_updates": 24,
      "decisions_added": 12,
      "per_task_discipline": 0.5
    },
    "requirementCoverage": {
      "total_criteria": 51,
      "fully_met": 47,
      "partially_met": 4,
      "not_met": 0,
      "coverage_ratio": 0.961,
      "partial_criteria": [
        "sc-03",
        "sc-10",
        "sc-34",
        "sc-40"
      ]
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 12,
      "tasks_planned": 24,
      "tasks_completed": 24,
      "tasks_blocked": 0,
      "decisions_captured": 12,
      "state_updates": 24,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 0.961,
      "architecture_alignment": 1,
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.973,
      "per_task_discipline": 0.5,
      "composite": 0.821
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [
        {
          "skill": "/gad:plan-phase",
          "when": "before implementation",
          "triggered": true
        },
        {
          "skill": "/gad:execute-phase",
          "when": "per phase",
          "triggered": true
        },
        {
          "skill": "/gad:task-checkpoint",
          "when": "between tasks",
          "triggered": true
        },
        {
          "skill": "/gad:auto-conventions",
          "when": "after first code phase",
          "triggered": true
        },
        {
          "skill": "/gad:verify-work",
          "when": "after phase completion",
          "triggered": false
        }
      ],
      "accuracy": 0.8
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/reader-workspace/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<requirements>\r\n  <goal>A browser-based EPUB reader workspace with library shelf, annotations, reading progress, and planning integration — shipped as a reusable React package.</goal>\r\n  <audience>Portfolio visitors reading built-in EPUB editions, and workspace owners who import/upload personal EPUBs with persistent progress and highlights.</audience>\r\n\r\n  <success-criteria>\r\n    <!-- EPUB rendering -->\r\n    <criterion id=\"sc-01\">Render EPUB files from both remote URL and local ArrayBuffer sources using the react-reader library.</criterion>\r\n    <criterion id=\"sc-02\">Support paginated (book-like spread) and scrolled-doc flow modes, toggled by a preferPagedReader setting.</criterion>\r\n    <criterion id=\"sc-03\">Automatically switch between single-page and two-page spread layout based on viewport width (threshold ~1050px).</criterion>\r\n    <criterion id=\"sc-04\">Apply a custom sepia-toned reader theme with serif typography to EPUB content frames.</criterion>\r\n    <criterion id=\"sc-05\">Display a Table of Contents panel that slides in from the left with animated transitions (framer-motion), showing nested TOC items.</criterion>\r\n    <criterion id=\"sc-06\">Show current section label, page number, and total pages in a bottom navigation bar.</criterion>\r\n    <criterion id=\"sc-07\">Provide prev/next page navigation buttons and direct page-number jump input.</criterion>\r\n    <criterion id=\"sc-08\">Calculate reading progress as a percentage from EPUB location data (CFI-based).</criterion>\r\n    <criterion id=\"sc-09\">Restore reading position on return — persist last location per book using a storage key.</criterion>\r\n    <criterion id=\"sc-10\">Support deep-linking to a specific EPUB location via URL search params (book, record, at, cfi).</criterion>\r\n\r\n    <!-- Library / shelf -->\r\n    <criterion id=\"sc-11\">Display a library shelf view with book cards in a responsive grid (2-col on sm, 3-col on xl).</criterion>\r\n    <criterion id=\"sc-12\">Each shelf card shows cover image (or generated empty cover with initials), title, author, genres, description, and reading status badge.</criterion>\r\n    <criterion id=\"sc-13\">Reading status badges resolve to New, N% progress, Done, or Coming Soon based on stored progress.</criterion>\r\n    <criterion id=\"sc-14\">Partition shelf into built-in books (with EPUBs), queued books (no EPUB yet), and uploaded library books.</criterion>\r\n    <criterion id=\"sc-15\">Filter the shelf by genre chips (All + distinct genres extracted from book entries).</criterion>\r\n    <criterion id=\"sc-16\">Filter the shelf by free-text search across title, slug, author, description, and genres.</criterion>\r\n    <criterion id=\"sc-17\">Drag-and-drop EPUB files onto the library view to import them.</criterion>\r\n    <criterion id=\"sc-18\">Import EPUB via file picker button, validating .epub extension.</criterion>\r\n    <criterion id=\"sc-19\">Format uploaded file name into a display title (strip extension, replace separators with spaces).</criterion>\r\n\r\n    <!-- Sidebar navigation -->\r\n    <criterion id=\"sc-20\">Render a collapsible sidebar rail on desktop (expanded: 15.5rem, collapsed: 4.25rem) with animated width transition.</criterion>\r\n    <criterion id=\"sc-21\">Show a slide-over mobile drawer on viewports below md, with backdrop overlay and body scroll lock.</criterion>\r\n    <criterion id=\"sc-22\">Sidebar shows Library link, Now Reading indicator when a book is open, and optional host-provided nav links with contextual icons.</criterion>\r\n    <criterion id=\"sc-23\">Sidebar collapse/expand state persists in localStorage via a zustand store.</criterion>\r\n\r\n    <!-- Annotations and highlights -->\r\n    <criterion id=\"sc-24\">Allow text selection in the EPUB to create highlights with amber overlay styling.</criterion>\r\n    <criterion id=\"sc-25\">Show a floating selection toolbar with Add Highlight and Dismiss actions when text is selected.</criterion>\r\n    <criterion id=\"sc-26\">Display a Notes and Highlights side panel (slides from right) listing all annotations with quoted text and editable note fields.</criterion>\r\n    <criterion id=\"sc-27\">Support Go To navigation (jump to annotation CFI) and Remove for each annotation.</criterion>\r\n    <criterion id=\"sc-28\">Export annotations as a JSON file following the portfolio-epub-annotations schema.</criterion>\r\n    <criterion id=\"sc-29\">Import annotations from a JSON file and re-apply highlights to the rendition.</criterion>\r\n    <criterion id=\"sc-30\">Download an annotated EPUB with annotations embedded in META-INF/portfolio-annotations.json.</criterion>\r\n    <criterion id=\"sc-31\">Persist annotations locally in IndexedDB keyed by storageKey + contentHash (SHA-256 of EPUB bytes).</criterion>\r\n    <criterion id=\"sc-32\">Merge local, embedded, and remote annotations using last-write-wins by updatedAt timestamp.</criterion>\r\n\r\n    <!-- Persistence -->\r\n    <criterion id=\"sc-33\">Track reading progress and location in a zustand store persisted to localStorage as a single JSON blob (portfolio-reader-epub-reading).</criterion>\r\n    <criterion id=\"sc-34\">Migrate legacy per-book localStorage keys (epub-location-*, epub-progress-*) into the consolidated store on first access.</criterion>\r\n    <criterion id=\"sc-35\">Cross-tab synchronization — rehydrate the reading store when the storage event fires for the store key.</criterion>\r\n    <criterion id=\"sc-36\">Support an optional ReaderPersistenceAdapter for remote save/load of location, progress, and annotations.</criterion>\r\n    <criterion id=\"sc-37\">Debounce remote persistence writes by 500ms to avoid excessive API calls.</criterion>\r\n\r\n    <!-- Workspace settings and access -->\r\n    <criterion id=\"sc-38\">Owner workspace mode with access state controlling canPersist, canEdit, canUpload permissions.</criterion>\r\n    <criterion id=\"sc-39\">Workspace settings panel (default view, prefer paged reader, show progress badges) persisted via host callback.</criterion>\r\n    <criterion id=\"sc-40\">Continue-reading mode: when defaultWorkspaceView is continue-reading, auto-select the first book with saved progress on load.</criterion>\r\n    <criterion id=\"sc-41\">Explicit upload panel for saving an imported EPUB to the backend library with title, author, description, visibility fields.</criterion>\r\n    <criterion id=\"sc-42\">Upload requires explicit action — importing does not auto-upload; a separate Upload to Library flow is gated by canUpload.</criterion>\r\n\r\n    <!-- Modal system -->\r\n    <criterion id=\"sc-43\">Planning cockpit modal rendered as a full-screen overlay with backdrop blur, managed by a dedicated zustand store.</criterion>\r\n    <criterion id=\"sc-44\">Modal accepts a host-provided renderPlanningCockpit render function and a ReaderPlanningCockpitPayload.</criterion>\r\n\r\n    <!-- Planning strip -->\r\n    <criterion id=\"sc-45\">Collapsible planning strip bar between header and content area, showing Planning and Planning Cockpit buttons.</criterion>\r\n    <criterion id=\"sc-46\">Expandable quick-links row within the planning strip using animated height transition.</criterion>\r\n\r\n    <!-- Planning pack extraction -->\r\n    <criterion id=\"sc-47\">Extract planning packs from EPUB files by reading a planning-pack manifest or falling back to plan-*.xhtml files.</criterion>\r\n    <criterion id=\"sc-48\">Parse XHTML content into plain text for planning pack files, stripping HTML tags and decoding entities.</criterion>\r\n\r\n    <!-- Lazy loading -->\r\n    <criterion id=\"sc-49\">Lazy-load the EpubViewer component using React.lazy with a Suspense fallback showing a loading spinner.</criterion>\r\n\r\n    <!-- EPUB download -->\r\n    <criterion id=\"sc-50\">Provide a Download EPUB button for built-in books, constructing the download URL from slug or remoteEpubUrl.</criterion>\r\n\r\n    <!-- Chrome theming -->\r\n    <criterion id=\"sc-51\">All workspace chrome uses semantic Tailwind/shadcn tokens (bg-background, border-border, text-foreground) — no separate light/dark palettes.</criterion>\r\n  </success-criteria>\r\n\r\n  <non-goals>\r\n    <item>The reader does NOT include a full CMS or book authoring interface — it is read-only with import.</item>\r\n    <item>The reader does NOT handle EPUB building/compilation — that is the repub-builder CLI concern.</item>\r\n    <item>The reader does NOT implement authentication — it accepts access state from the host.</item>\r\n    <item>The reader does NOT render non-EPUB formats (PDF, MOBI, etc.).</item>\r\n  </non-goals>\r\n\r\n  <core-systems>\r\n    <system id=\"epub-viewer\">EPUB rendering engine wrapping react-reader (epubjs). Handles book loading (URL fetch or ArrayBuffer), rendition configuration (theme, flow, spread), location tracking, TOC extraction, page calculation, and text selection events. Provides prev/next navigation and page jump.</system>\r\n    <system id=\"workspace-shell\">Top-level workspace layout orchestrating the sidebar, header toolbar, planning strip, content area, and modal root. Manages EPUB import (file picker + drag-drop), workspace state resolution, and child component composition.</system>\r\n    <system id=\"library-shelf\">Library view with searchable, filterable book card grid. Partitions books by source kind and EPUB availability. Each card shows metadata, cover, status badge, and action controls. Cards link to the reader view for that book.</system>\r\n    <system id=\"sidebar-nav\">Collapsible navigation rail with desktop aside and mobile slide-over drawer. Shows brand header, Library link, Now Reading section, and host-injected navigation links. Collapse state persisted in a UI store.</system>\r\n    <system id=\"annotations-engine\">Highlight and note system. Creates highlights from text selections on the EPUB rendition. Persists to IndexedDB keyed by book+hash. Supports JSON import/export and embedding annotations inside EPUB ZIP archives. Merges annotations from multiple sources (local, embedded, remote) using timestamp-based conflict resolution.</system>\r\n    <system id=\"reading-store\">Zustand store (persist + immer middleware) tracking per-book reading progress (0-1 float) and last CFI location. Single localStorage JSON blob with legacy key migration. Cross-tab sync via storage event listener.</system>\r\n    <system id=\"workspace-ui-store\">Zustand store persisting sidebar expanded state and shelf genre filter. Includes legacy key migration from older localStorage formats.</system>\r\n    <system id=\"persistence-adapter\">Adapter interface for optional remote persistence. Accepts loadState/saveState with storageKey + contentHash. Merges remote state with local on hydration. Debounced writes.</system>\r\n    <system id=\"modal-system\">Zustand store for planning cockpit modal (open/close + payload). ReaderModalRoot renders the overlay with host-provided content function.</system>\r\n    <system id=\"planning-integration\">Planning strip with quick-links and cockpit button. Planning pack extraction from EPUB archives. Host-configurable per-book planning payload.</system>\r\n    <system id=\"ui-primitives\">Lightweight UI primitives (Button, Card, Badge, Input, Select, Textarea, Checkbox) with variant/size props and a minimal cn() class merge utility. Not shadcn/ui directly — custom implementations matching shadcn conventions.</system>\r\n    <system id=\"chrome-theme\">Single object mapping semantic slot names to Tailwind class strings. All workspace components reference this map for consistent theming.</system>\r\n    <system id=\"route-builder\">Utility function constructing reader URLs from a base path and optional search params (book, record, at, cfi).</system>\r\n  </core-systems>\r\n\r\n  <stack>\r\n    <item>React 19 — component UI and hooks for state/effects</item>\r\n    <item>TypeScript — strict typing for all modules, exported type definitions for host integration</item>\r\n    <item>react-reader v2 (epubjs wrapper) — EPUB rendering, TOC, location management, rendition API</item>\r\n    <item>zustand v5 with persist + immer middleware — client-side state management with localStorage persistence</item>\r\n    <item>framer-motion — animated transitions for TOC panel, notes panel, and planning strip</item>\r\n    <item>lucide-react — icon library for all UI icons</item>\r\n    <item>jszip — reading/writing ZIP archives for annotation embedding and planning pack extraction</item>\r\n    <item>Tailwind CSS — utility-first styling with shadcn semantic token conventions</item>\r\n    <item>tsup — build tooling for the package (ESM output)</item>\r\n    <item>vitest — test runner</item>\r\n  </stack>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 12,
      "commit_discipline": 1
    }
  },
  {
    "project": "reader-workspace",
    "version": "v2",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T03:42:00.000Z",
      "ended": "2026-04-07T04:22:00.000Z",
      "duration_minutes": 40,
      "phases_completed": 11,
      "tasks_completed": 40
    },
    "tokenUsage": {
      "total_tokens": 152849,
      "tool_uses": 261
    },
    "gitAnalysis": {
      "total_commits": 37,
      "task_id_commits": 37,
      "batch_commits": 0,
      "source_files_created": 37,
      "state_updates": 40,
      "decisions_added": 0,
      "per_task_discipline": 0.925
    },
    "requirementCoverage": {
      "total_criteria": 51,
      "fully_met": 51,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 11,
      "tasks_planned": 40,
      "tasks_completed": 40,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 40,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 0.8,
      "time_efficiency": 0.917,
      "per_task_discipline": 0.925,
      "composite": 0.928
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": null,
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/reader-workspace/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<requirements>\r\n  <goal>A browser-based EPUB reader workspace with library shelf, annotations, reading progress, and planning integration — shipped as a reusable React package.</goal>\r\n  <audience>Portfolio visitors reading built-in EPUB editions, and workspace owners who import/upload personal EPUBs with persistent progress and highlights.</audience>\r\n\r\n  <success-criteria>\r\n    <!-- EPUB rendering -->\r\n    <criterion id=\"sc-01\">Render EPUB files from both remote URL and local ArrayBuffer sources using the react-reader library.</criterion>\r\n    <criterion id=\"sc-02\">Support paginated (book-like spread) and scrolled-doc flow modes, toggled by a preferPagedReader setting.</criterion>\r\n    <criterion id=\"sc-03\">Automatically switch between single-page and two-page spread layout based on viewport width (threshold ~1050px).</criterion>\r\n    <criterion id=\"sc-04\">Apply a custom sepia-toned reader theme with serif typography to EPUB content frames.</criterion>\r\n    <criterion id=\"sc-05\">Display a Table of Contents panel that slides in from the left with animated transitions (framer-motion), showing nested TOC items.</criterion>\r\n    <criterion id=\"sc-06\">Show current section label, page number, and total pages in a bottom navigation bar.</criterion>\r\n    <criterion id=\"sc-07\">Provide prev/next page navigation buttons and direct page-number jump input.</criterion>\r\n    <criterion id=\"sc-08\">Calculate reading progress as a percentage from EPUB location data (CFI-based).</criterion>\r\n    <criterion id=\"sc-09\">Restore reading position on return — persist last location per book using a storage key.</criterion>\r\n    <criterion id=\"sc-10\">Support deep-linking to a specific EPUB location via URL search params (book, record, at, cfi).</criterion>\r\n\r\n    <!-- Library / shelf -->\r\n    <criterion id=\"sc-11\">Display a library shelf view with book cards in a responsive grid (2-col on sm, 3-col on xl).</criterion>\r\n    <criterion id=\"sc-12\">Each shelf card shows cover image (or generated empty cover with initials), title, author, genres, description, and reading status badge.</criterion>\r\n    <criterion id=\"sc-13\">Reading status badges resolve to New, N% progress, Done, or Coming Soon based on stored progress.</criterion>\r\n    <criterion id=\"sc-14\">Partition shelf into built-in books (with EPUBs), queued books (no EPUB yet), and uploaded library books.</criterion>\r\n    <criterion id=\"sc-15\">Filter the shelf by genre chips (All + distinct genres extracted from book entries).</criterion>\r\n    <criterion id=\"sc-16\">Filter the shelf by free-text search across title, slug, author, description, and genres.</criterion>\r\n    <criterion id=\"sc-17\">Drag-and-drop EPUB files onto the library view to import them.</criterion>\r\n    <criterion id=\"sc-18\">Import EPUB via file picker button, validating .epub extension.</criterion>\r\n    <criterion id=\"sc-19\">Format uploaded file name into a display title (strip extension, replace separators with spaces).</criterion>\r\n\r\n    <!-- Sidebar navigation -->\r\n    <criterion id=\"sc-20\">Render a collapsible sidebar rail on desktop (expanded: 15.5rem, collapsed: 4.25rem) with animated width transition.</criterion>\r\n    <criterion id=\"sc-21\">Show a slide-over mobile drawer on viewports below md, with backdrop overlay and body scroll lock.</criterion>\r\n    <criterion id=\"sc-22\">Sidebar shows Library link, Now Reading indicator when a book is open, and optional host-provided nav links with contextual icons.</criterion>\r\n    <criterion id=\"sc-23\">Sidebar collapse/expand state persists in localStorage via a zustand store.</criterion>\r\n\r\n    <!-- Annotations and highlights -->\r\n    <criterion id=\"sc-24\">Allow text selection in the EPUB to create highlights with amber overlay styling.</criterion>\r\n    <criterion id=\"sc-25\">Show a floating selection toolbar with Add Highlight and Dismiss actions when text is selected.</criterion>\r\n    <criterion id=\"sc-26\">Display a Notes and Highlights side panel (slides from right) listing all annotations with quoted text and editable note fields.</criterion>\r\n    <criterion id=\"sc-27\">Support Go To navigation (jump to annotation CFI) and Remove for each annotation.</criterion>\r\n    <criterion id=\"sc-28\">Export annotations as a JSON file following the portfolio-epub-annotations schema.</criterion>\r\n    <criterion id=\"sc-29\">Import annotations from a JSON file and re-apply highlights to the rendition.</criterion>\r\n    <criterion id=\"sc-30\">Download an annotated EPUB with annotations embedded in META-INF/portfolio-annotations.json.</criterion>\r\n    <criterion id=\"sc-31\">Persist annotations locally in IndexedDB keyed by storageKey + contentHash (SHA-256 of EPUB bytes).</criterion>\r\n    <criterion id=\"sc-32\">Merge local, embedded, and remote annotations using last-write-wins by updatedAt timestamp.</criterion>\r\n\r\n    <!-- Persistence -->\r\n    <criterion id=\"sc-33\">Track reading progress and location in a zustand store persisted to localStorage as a single JSON blob (portfolio-reader-epub-reading).</criterion>\r\n    <criterion id=\"sc-34\">Migrate legacy per-book localStorage keys (epub-location-*, epub-progress-*) into the consolidated store on first access.</criterion>\r\n    <criterion id=\"sc-35\">Cross-tab synchronization — rehydrate the reading store when the storage event fires for the store key.</criterion>\r\n    <criterion id=\"sc-36\">Support an optional ReaderPersistenceAdapter for remote save/load of location, progress, and annotations.</criterion>\r\n    <criterion id=\"sc-37\">Debounce remote persistence writes by 500ms to avoid excessive API calls.</criterion>\r\n\r\n    <!-- Workspace settings and access -->\r\n    <criterion id=\"sc-38\">Owner workspace mode with access state controlling canPersist, canEdit, canUpload permissions.</criterion>\r\n    <criterion id=\"sc-39\">Workspace settings panel (default view, prefer paged reader, show progress badges) persisted via host callback.</criterion>\r\n    <criterion id=\"sc-40\">Continue-reading mode: when defaultWorkspaceView is continue-reading, auto-select the first book with saved progress on load.</criterion>\r\n    <criterion id=\"sc-41\">Explicit upload panel for saving an imported EPUB to the backend library with title, author, description, visibility fields.</criterion>\r\n    <criterion id=\"sc-42\">Upload requires explicit action — importing does not auto-upload; a separate Upload to Library flow is gated by canUpload.</criterion>\r\n\r\n    <!-- Modal system -->\r\n    <criterion id=\"sc-43\">Planning cockpit modal rendered as a full-screen overlay with backdrop blur, managed by a dedicated zustand store.</criterion>\r\n    <criterion id=\"sc-44\">Modal accepts a host-provided renderPlanningCockpit render function and a ReaderPlanningCockpitPayload.</criterion>\r\n\r\n    <!-- Planning strip -->\r\n    <criterion id=\"sc-45\">Collapsible planning strip bar between header and content area, showing Planning and Planning Cockpit buttons.</criterion>\r\n    <criterion id=\"sc-46\">Expandable quick-links row within the planning strip using animated height transition.</criterion>\r\n\r\n    <!-- Planning pack extraction -->\r\n    <criterion id=\"sc-47\">Extract planning packs from EPUB files by reading a planning-pack manifest or falling back to plan-*.xhtml files.</criterion>\r\n    <criterion id=\"sc-48\">Parse XHTML content into plain text for planning pack files, stripping HTML tags and decoding entities.</criterion>\r\n\r\n    <!-- Lazy loading -->\r\n    <criterion id=\"sc-49\">Lazy-load the EpubViewer component using React.lazy with a Suspense fallback showing a loading spinner.</criterion>\r\n\r\n    <!-- EPUB download -->\r\n    <criterion id=\"sc-50\">Provide a Download EPUB button for built-in books, constructing the download URL from slug or remoteEpubUrl.</criterion>\r\n\r\n    <!-- Chrome theming -->\r\n    <criterion id=\"sc-51\">All workspace chrome uses semantic Tailwind/shadcn tokens (bg-background, border-border, text-foreground) — no separate light/dark palettes.</criterion>\r\n  </success-criteria>\r\n\r\n  <non-goals>\r\n    <item>The reader does NOT include a full CMS or book authoring interface — it is read-only with import.</item>\r\n    <item>The reader does NOT handle EPUB building/compilation — that is the repub-builder CLI concern.</item>\r\n    <item>The reader does NOT implement authentication — it accepts access state from the host.</item>\r\n    <item>The reader does NOT render non-EPUB formats (PDF, MOBI, etc.).</item>\r\n  </non-goals>\r\n\r\n  <core-systems>\r\n    <system id=\"epub-viewer\">EPUB rendering engine wrapping react-reader (epubjs). Handles book loading (URL fetch or ArrayBuffer), rendition configuration (theme, flow, spread), location tracking, TOC extraction, page calculation, and text selection events. Provides prev/next navigation and page jump.</system>\r\n    <system id=\"workspace-shell\">Top-level workspace layout orchestrating the sidebar, header toolbar, planning strip, content area, and modal root. Manages EPUB import (file picker + drag-drop), workspace state resolution, and child component composition.</system>\r\n    <system id=\"library-shelf\">Library view with searchable, filterable book card grid. Partitions books by source kind and EPUB availability. Each card shows metadata, cover, status badge, and action controls. Cards link to the reader view for that book.</system>\r\n    <system id=\"sidebar-nav\">Collapsible navigation rail with desktop aside and mobile slide-over drawer. Shows brand header, Library link, Now Reading section, and host-injected navigation links. Collapse state persisted in a UI store.</system>\r\n    <system id=\"annotations-engine\">Highlight and note system. Creates highlights from text selections on the EPUB rendition. Persists to IndexedDB keyed by book+hash. Supports JSON import/export and embedding annotations inside EPUB ZIP archives. Merges annotations from multiple sources (local, embedded, remote) using timestamp-based conflict resolution.</system>\r\n    <system id=\"reading-store\">Zustand store (persist + immer middleware) tracking per-book reading progress (0-1 float) and last CFI location. Single localStorage JSON blob with legacy key migration. Cross-tab sync via storage event listener.</system>\r\n    <system id=\"workspace-ui-store\">Zustand store persisting sidebar expanded state and shelf genre filter. Includes legacy key migration from older localStorage formats.</system>\r\n    <system id=\"persistence-adapter\">Adapter interface for optional remote persistence. Accepts loadState/saveState with storageKey + contentHash. Merges remote state with local on hydration. Debounced writes.</system>\r\n    <system id=\"modal-system\">Zustand store for planning cockpit modal (open/close + payload). ReaderModalRoot renders the overlay with host-provided content function.</system>\r\n    <system id=\"planning-integration\">Planning strip with quick-links and cockpit button. Planning pack extraction from EPUB archives. Host-configurable per-book planning payload.</system>\r\n    <system id=\"ui-primitives\">Lightweight UI primitives (Button, Card, Badge, Input, Select, Textarea, Checkbox) with variant/size props and a minimal cn() class merge utility. Not shadcn/ui directly — custom implementations matching shadcn conventions.</system>\r\n    <system id=\"chrome-theme\">Single object mapping semantic slot names to Tailwind class strings. All workspace components reference this map for consistent theming.</system>\r\n    <system id=\"route-builder\">Utility function constructing reader URLs from a base path and optional search params (book, record, at, cfi).</system>\r\n  </core-systems>\r\n\r\n  <stack>\r\n    <item>React 19 — component UI and hooks for state/effects</item>\r\n    <item>TypeScript — strict typing for all modules, exported type definitions for host integration</item>\r\n    <item>react-reader v2 (epubjs wrapper) — EPUB rendering, TOC, location management, rendition API</item>\r\n    <item>zustand v5 with persist + immer middleware — client-side state management with localStorage persistence</item>\r\n    <item>framer-motion — animated transitions for TOC panel, notes panel, and planning strip</item>\r\n    <item>lucide-react — icon library for all UI icons</item>\r\n    <item>jszip — reading/writing ZIP archives for annotation embedding and planning pack extraction</item>\r\n    <item>Tailwind CSS — utility-first styling with shadcn semantic token conventions</item>\r\n    <item>tsup — build tooling for the package (ESM output)</item>\r\n    <item>vitest — test runner</item>\r\n  </stack>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 37,
      "commit_discipline": 1
    }
  },
  {
    "project": "reader-workspace",
    "version": "v3",
    "workflow": "gad",
    "requirementsVersion": "unknown",
    "date": "2026-04-07",
    "gadVersion": "1.32.0",
    "traceSchemaVersion": 3,
    "frameworkVersion": null,
    "frameworkCommit": null,
    "frameworkBranch": null,
    "frameworkCommitTs": null,
    "frameworkStamp": null,
    "traceEvents": null,
    "evalType": "implementation",
    "contextMode": "fresh",
    "timing": {
      "started": "2026-04-07T07:00:00.000Z",
      "ended": "2026-04-07T07:30:00.000Z",
      "duration_minutes": 30,
      "phases_completed": 11,
      "tasks_completed": 35
    },
    "tokenUsage": {
      "total_tokens": 136862,
      "tool_uses": 212
    },
    "gitAnalysis": {
      "total_commits": 23,
      "task_id_commits": 11,
      "batch_commits": 11,
      "source_files_created": 40,
      "state_updates": 35,
      "decisions_added": 0,
      "per_task_discipline": 0.31,
      "verify_commits": 11,
      "conventions_created": true
    },
    "requirementCoverage": {
      "total_criteria": 51,
      "fully_met": 51,
      "partially_met": 0,
      "not_met": 0,
      "coverage_ratio": 1
    },
    "workflowEmergence": null,
    "planningQuality": {
      "phases_planned": 11,
      "tasks_planned": 35,
      "tasks_completed": 35,
      "tasks_blocked": 0,
      "decisions_captured": 0,
      "state_updates": 35,
      "state_stale_count": 0
    },
    "scores": {
      "requirement_coverage": 1,
      "planning_quality": 1,
      "skill_accuracy": 1,
      "time_efficiency": 0.938,
      "per_task_discipline": 0.31,
      "composite": 0.83,
      "human_review": null,
      "auto_composite": 0.83
    },
    "humanReview": null,
    "humanReviewNormalized": {
      "rubric_version": "none",
      "dimensions": {},
      "aggregate_score": null,
      "notes": null,
      "reviewed_by": null,
      "reviewed_at": null,
      "is_legacy": true,
      "is_empty": true
    },
    "skillAccuracyBreakdown": {
      "expected_triggers": [
        {
          "skill": "/gad:plan-phase",
          "when": "before implementation",
          "triggered": true
        },
        {
          "skill": "/gad:execute-phase",
          "when": "per phase",
          "triggered": true
        },
        {
          "skill": "/gad:task-checkpoint",
          "when": "between tasks",
          "triggered": true
        },
        {
          "skill": "/gad:auto-conventions",
          "when": "after first code phase",
          "triggered": true
        },
        {
          "skill": "/gad:verify-work",
          "when": "after phase completion",
          "triggered": true
        },
        {
          "skill": "/gad:check-todos",
          "when": "session start",
          "triggered": true
        }
      ],
      "accuracy": 1
    },
    "requirementsDoc": {
      "filename": "REQUIREMENTS.xml (v4)",
      "path": "evals/reader-workspace/template/.planning/REQUIREMENTS.xml",
      "content": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<requirements>\r\n  <goal>A browser-based EPUB reader workspace with library shelf, annotations, reading progress, and planning integration — shipped as a reusable React package.</goal>\r\n  <audience>Portfolio visitors reading built-in EPUB editions, and workspace owners who import/upload personal EPUBs with persistent progress and highlights.</audience>\r\n\r\n  <success-criteria>\r\n    <!-- EPUB rendering -->\r\n    <criterion id=\"sc-01\">Render EPUB files from both remote URL and local ArrayBuffer sources using the react-reader library.</criterion>\r\n    <criterion id=\"sc-02\">Support paginated (book-like spread) and scrolled-doc flow modes, toggled by a preferPagedReader setting.</criterion>\r\n    <criterion id=\"sc-03\">Automatically switch between single-page and two-page spread layout based on viewport width (threshold ~1050px).</criterion>\r\n    <criterion id=\"sc-04\">Apply a custom sepia-toned reader theme with serif typography to EPUB content frames.</criterion>\r\n    <criterion id=\"sc-05\">Display a Table of Contents panel that slides in from the left with animated transitions (framer-motion), showing nested TOC items.</criterion>\r\n    <criterion id=\"sc-06\">Show current section label, page number, and total pages in a bottom navigation bar.</criterion>\r\n    <criterion id=\"sc-07\">Provide prev/next page navigation buttons and direct page-number jump input.</criterion>\r\n    <criterion id=\"sc-08\">Calculate reading progress as a percentage from EPUB location data (CFI-based).</criterion>\r\n    <criterion id=\"sc-09\">Restore reading position on return — persist last location per book using a storage key.</criterion>\r\n    <criterion id=\"sc-10\">Support deep-linking to a specific EPUB location via URL search params (book, record, at, cfi).</criterion>\r\n\r\n    <!-- Library / shelf -->\r\n    <criterion id=\"sc-11\">Display a library shelf view with book cards in a responsive grid (2-col on sm, 3-col on xl).</criterion>\r\n    <criterion id=\"sc-12\">Each shelf card shows cover image (or generated empty cover with initials), title, author, genres, description, and reading status badge.</criterion>\r\n    <criterion id=\"sc-13\">Reading status badges resolve to New, N% progress, Done, or Coming Soon based on stored progress.</criterion>\r\n    <criterion id=\"sc-14\">Partition shelf into built-in books (with EPUBs), queued books (no EPUB yet), and uploaded library books.</criterion>\r\n    <criterion id=\"sc-15\">Filter the shelf by genre chips (All + distinct genres extracted from book entries).</criterion>\r\n    <criterion id=\"sc-16\">Filter the shelf by free-text search across title, slug, author, description, and genres.</criterion>\r\n    <criterion id=\"sc-17\">Drag-and-drop EPUB files onto the library view to import them.</criterion>\r\n    <criterion id=\"sc-18\">Import EPUB via file picker button, validating .epub extension.</criterion>\r\n    <criterion id=\"sc-19\">Format uploaded file name into a display title (strip extension, replace separators with spaces).</criterion>\r\n\r\n    <!-- Sidebar navigation -->\r\n    <criterion id=\"sc-20\">Render a collapsible sidebar rail on desktop (expanded: 15.5rem, collapsed: 4.25rem) with animated width transition.</criterion>\r\n    <criterion id=\"sc-21\">Show a slide-over mobile drawer on viewports below md, with backdrop overlay and body scroll lock.</criterion>\r\n    <criterion id=\"sc-22\">Sidebar shows Library link, Now Reading indicator when a book is open, and optional host-provided nav links with contextual icons.</criterion>\r\n    <criterion id=\"sc-23\">Sidebar collapse/expand state persists in localStorage via a zustand store.</criterion>\r\n\r\n    <!-- Annotations and highlights -->\r\n    <criterion id=\"sc-24\">Allow text selection in the EPUB to create highlights with amber overlay styling.</criterion>\r\n    <criterion id=\"sc-25\">Show a floating selection toolbar with Add Highlight and Dismiss actions when text is selected.</criterion>\r\n    <criterion id=\"sc-26\">Display a Notes and Highlights side panel (slides from right) listing all annotations with quoted text and editable note fields.</criterion>\r\n    <criterion id=\"sc-27\">Support Go To navigation (jump to annotation CFI) and Remove for each annotation.</criterion>\r\n    <criterion id=\"sc-28\">Export annotations as a JSON file following the portfolio-epub-annotations schema.</criterion>\r\n    <criterion id=\"sc-29\">Import annotations from a JSON file and re-apply highlights to the rendition.</criterion>\r\n    <criterion id=\"sc-30\">Download an annotated EPUB with annotations embedded in META-INF/portfolio-annotations.json.</criterion>\r\n    <criterion id=\"sc-31\">Persist annotations locally in IndexedDB keyed by storageKey + contentHash (SHA-256 of EPUB bytes).</criterion>\r\n    <criterion id=\"sc-32\">Merge local, embedded, and remote annotations using last-write-wins by updatedAt timestamp.</criterion>\r\n\r\n    <!-- Persistence -->\r\n    <criterion id=\"sc-33\">Track reading progress and location in a zustand store persisted to localStorage as a single JSON blob (portfolio-reader-epub-reading).</criterion>\r\n    <criterion id=\"sc-34\">Migrate legacy per-book localStorage keys (epub-location-*, epub-progress-*) into the consolidated store on first access.</criterion>\r\n    <criterion id=\"sc-35\">Cross-tab synchronization — rehydrate the reading store when the storage event fires for the store key.</criterion>\r\n    <criterion id=\"sc-36\">Support an optional ReaderPersistenceAdapter for remote save/load of location, progress, and annotations.</criterion>\r\n    <criterion id=\"sc-37\">Debounce remote persistence writes by 500ms to avoid excessive API calls.</criterion>\r\n\r\n    <!-- Workspace settings and access -->\r\n    <criterion id=\"sc-38\">Owner workspace mode with access state controlling canPersist, canEdit, canUpload permissions.</criterion>\r\n    <criterion id=\"sc-39\">Workspace settings panel (default view, prefer paged reader, show progress badges) persisted via host callback.</criterion>\r\n    <criterion id=\"sc-40\">Continue-reading mode: when defaultWorkspaceView is continue-reading, auto-select the first book with saved progress on load.</criterion>\r\n    <criterion id=\"sc-41\">Explicit upload panel for saving an imported EPUB to the backend library with title, author, description, visibility fields.</criterion>\r\n    <criterion id=\"sc-42\">Upload requires explicit action — importing does not auto-upload; a separate Upload to Library flow is gated by canUpload.</criterion>\r\n\r\n    <!-- Modal system -->\r\n    <criterion id=\"sc-43\">Planning cockpit modal rendered as a full-screen overlay with backdrop blur, managed by a dedicated zustand store.</criterion>\r\n    <criterion id=\"sc-44\">Modal accepts a host-provided renderPlanningCockpit render function and a ReaderPlanningCockpitPayload.</criterion>\r\n\r\n    <!-- Planning strip -->\r\n    <criterion id=\"sc-45\">Collapsible planning strip bar between header and content area, showing Planning and Planning Cockpit buttons.</criterion>\r\n    <criterion id=\"sc-46\">Expandable quick-links row within the planning strip using animated height transition.</criterion>\r\n\r\n    <!-- Planning pack extraction -->\r\n    <criterion id=\"sc-47\">Extract planning packs from EPUB files by reading a planning-pack manifest or falling back to plan-*.xhtml files.</criterion>\r\n    <criterion id=\"sc-48\">Parse XHTML content into plain text for planning pack files, stripping HTML tags and decoding entities.</criterion>\r\n\r\n    <!-- Lazy loading -->\r\n    <criterion id=\"sc-49\">Lazy-load the EpubViewer component using React.lazy with a Suspense fallback showing a loading spinner.</criterion>\r\n\r\n    <!-- EPUB download -->\r\n    <criterion id=\"sc-50\">Provide a Download EPUB button for built-in books, constructing the download URL from slug or remoteEpubUrl.</criterion>\r\n\r\n    <!-- Chrome theming -->\r\n    <criterion id=\"sc-51\">All workspace chrome uses semantic Tailwind/shadcn tokens (bg-background, border-border, text-foreground) — no separate light/dark palettes.</criterion>\r\n  </success-criteria>\r\n\r\n  <non-goals>\r\n    <item>The reader does NOT include a full CMS or book authoring interface — it is read-only with import.</item>\r\n    <item>The reader does NOT handle EPUB building/compilation — that is the repub-builder CLI concern.</item>\r\n    <item>The reader does NOT implement authentication — it accepts access state from the host.</item>\r\n    <item>The reader does NOT render non-EPUB formats (PDF, MOBI, etc.).</item>\r\n  </non-goals>\r\n\r\n  <core-systems>\r\n    <system id=\"epub-viewer\">EPUB rendering engine wrapping react-reader (epubjs). Handles book loading (URL fetch or ArrayBuffer), rendition configuration (theme, flow, spread), location tracking, TOC extraction, page calculation, and text selection events. Provides prev/next navigation and page jump.</system>\r\n    <system id=\"workspace-shell\">Top-level workspace layout orchestrating the sidebar, header toolbar, planning strip, content area, and modal root. Manages EPUB import (file picker + drag-drop), workspace state resolution, and child component composition.</system>\r\n    <system id=\"library-shelf\">Library view with searchable, filterable book card grid. Partitions books by source kind and EPUB availability. Each card shows metadata, cover, status badge, and action controls. Cards link to the reader view for that book.</system>\r\n    <system id=\"sidebar-nav\">Collapsible navigation rail with desktop aside and mobile slide-over drawer. Shows brand header, Library link, Now Reading section, and host-injected navigation links. Collapse state persisted in a UI store.</system>\r\n    <system id=\"annotations-engine\">Highlight and note system. Creates highlights from text selections on the EPUB rendition. Persists to IndexedDB keyed by book+hash. Supports JSON import/export and embedding annotations inside EPUB ZIP archives. Merges annotations from multiple sources (local, embedded, remote) using timestamp-based conflict resolution.</system>\r\n    <system id=\"reading-store\">Zustand store (persist + immer middleware) tracking per-book reading progress (0-1 float) and last CFI location. Single localStorage JSON blob with legacy key migration. Cross-tab sync via storage event listener.</system>\r\n    <system id=\"workspace-ui-store\">Zustand store persisting sidebar expanded state and shelf genre filter. Includes legacy key migration from older localStorage formats.</system>\r\n    <system id=\"persistence-adapter\">Adapter interface for optional remote persistence. Accepts loadState/saveState with storageKey + contentHash. Merges remote state with local on hydration. Debounced writes.</system>\r\n    <system id=\"modal-system\">Zustand store for planning cockpit modal (open/close + payload). ReaderModalRoot renders the overlay with host-provided content function.</system>\r\n    <system id=\"planning-integration\">Planning strip with quick-links and cockpit button. Planning pack extraction from EPUB archives. Host-configurable per-book planning payload.</system>\r\n    <system id=\"ui-primitives\">Lightweight UI primitives (Button, Card, Badge, Input, Select, Textarea, Checkbox) with variant/size props and a minimal cn() class merge utility. Not shadcn/ui directly — custom implementations matching shadcn conventions.</system>\r\n    <system id=\"chrome-theme\">Single object mapping semantic slot names to Tailwind class strings. All workspace components reference this map for consistent theming.</system>\r\n    <system id=\"route-builder\">Utility function constructing reader URLs from a base path and optional search params (book, record, at, cfi).</system>\r\n  </core-systems>\r\n\r\n  <stack>\r\n    <item>React 19 — component UI and hooks for state/effects</item>\r\n    <item>TypeScript — strict typing for all modules, exported type definitions for host integration</item>\r\n    <item>react-reader v2 (epubjs wrapper) — EPUB rendering, TOC, location management, rendition API</item>\r\n    <item>zustand v5 with persist + immer middleware — client-side state management with localStorage persistence</item>\r\n    <item>framer-motion — animated transitions for TOC panel, notes panel, and planning strip</item>\r\n    <item>lucide-react — icon library for all UI icons</item>\r\n    <item>jszip — reading/writing ZIP archives for annotation embedding and planning pack extraction</item>\r\n    <item>Tailwind CSS — utility-first styling with shadcn semantic token conventions</item>\r\n    <item>tsup — build tooling for the package (ESM output)</item>\r\n    <item>vitest — test runner</item>\r\n  </stack>\r\n</requirements>\r\n",
      "format": "xml"
    },
    "topSkill": null,
    "derived": {
      "divergence_score": null,
      "plan_adherence_delta": 0,
      "produced_artifact_density": null,
      "tool_use_mix": null,
      "skill_to_tool_ratio": null,
      "subagent_utilization": null,
      "total_commits": 23,
      "commit_discipline": 0.4782608695652174
    }
  }
];

export const EVAL_TEMPLATES: EvalTemplateAsset[] = [
  {
    "project": "escape-the-dungeon",
    "zipPath": "/downloads/eval-escape-the-dungeon-template.zip",
    "bytes": 20763
  },
  {
    "project": "escape-the-dungeon-bare",
    "zipPath": "/downloads/eval-escape-the-dungeon-bare-template.zip",
    "bytes": 22962
  },
  {
    "project": "escape-the-dungeon-emergent",
    "zipPath": "/downloads/eval-escape-the-dungeon-emergent-template.zip",
    "bytes": 28666
  },
  {
    "project": "etd-brownfield-bare",
    "zipPath": "/downloads/eval-etd-brownfield-bare-template.zip",
    "bytes": 1130
  },
  {
    "project": "etd-brownfield-emergent",
    "zipPath": "/downloads/eval-etd-brownfield-emergent-template.zip",
    "bytes": 1063
  },
  {
    "project": "etd-brownfield-gad",
    "zipPath": "/downloads/eval-etd-brownfield-gad-template.zip",
    "bytes": 1410
  },
  {
    "project": "reader-workspace",
    "zipPath": "/downloads/eval-reader-workspace-template.zip",
    "bytes": 15255
  }
];

export const PLANNING_ZIPS: PlanningZipAsset[] = [
  {
    "project": "escape-the-dungeon",
    "zipPath": "/downloads/planning/eval-escape-the-dungeon-planning.zip",
    "bytes": 20763,
    "files": 8
  },
  {
    "project": "escape-the-dungeon-bare",
    "zipPath": "/downloads/planning/eval-escape-the-dungeon-bare-planning.zip",
    "bytes": 22962,
    "files": 6
  },
  {
    "project": "escape-the-dungeon-emergent",
    "zipPath": "/downloads/planning/eval-escape-the-dungeon-emergent-planning.zip",
    "bytes": 28666,
    "files": 11
  },
  {
    "project": "etd-brownfield-bare",
    "zipPath": "/downloads/planning/eval-etd-brownfield-bare-planning.zip",
    "bytes": 1130,
    "files": 1
  },
  {
    "project": "etd-brownfield-emergent",
    "zipPath": "/downloads/planning/eval-etd-brownfield-emergent-planning.zip",
    "bytes": 1063,
    "files": 1
  },
  {
    "project": "etd-brownfield-gad",
    "zipPath": "/downloads/planning/eval-etd-brownfield-gad-planning.zip",
    "bytes": 1410,
    "files": 1
  },
  {
    "project": "reader-workspace",
    "zipPath": "/downloads/planning/eval-reader-workspace-planning.zip",
    "bytes": 15255,
    "files": 6
  }
];

export const GAD_PACK_TEMPLATE = {
  "zipPath": "/downloads/gad-pack-template.zip",
  "bytes": 91146
};

export const ROUND_SUMMARIES: RoundSummary[] = [
  {
    "round": "Round 1",
    "title": "Greenfield, single-condition, requirements v1",
    "body": "**Date:** 2026-04-06 to 2026-04-07\n**Requirements version:** v1 (12 systems-focused criteria, no gates)\n**Conditions:** GAD only (escape-the-dungeon v1-v5)\n**Results:**\n- v1-v4: Iterative development of the GAD eval harness itself. Not scored.\n- **v5:** Auto-composite 0.935, human review 0.0 (blank screen). Gap between\n  automated scoring and reality first exposed here.\n\n**Key finding:** Automated scoring without human review is dangerously misleading.\nrequirement_coverage was 1.0 but nothing rendered.\n\n**Led to:** Gate criteria design, human_review weight increase, build-must-render rule.\n\n---"
  },
  {
    "round": "Round 2",
    "title": "Greenfield, three-condition, requirements v2",
    "body": "**Date:** 2026-04-08\n**Requirements version:** v2 (added gate criteria, vertical-slice priority, UI-first)\n**Conditions:** GAD v6/v7, Bare v1/v2, Emergent v1\n\n**Results:**\n| Condition | Version | Tokens | Commits | Human |\n|-----------|---------|--------|---------|-------|\n| GAD | v6 | ~100k | 21 | 0.00 (blank screen) |\n| GAD | v7 | 93k | 21 | 0.30 (stuck after combat) |\n| Bare | v1 | 68k | 2 | 0.10 (main menu only) |\n| Bare | v2 | 88k | 6 | **0.50** (most playable) |\n| Emergent | v1 | 67k | 2 | 0.10 (styled text crash) |\n\n**Key findings:**\n1. Bare workflow beats GAD on human review even at equal requirements\n2. Inherited skills (emergent v1) didn't prevent new failure modes\n3. GAD has perfect process metrics (planning_quality 1.0) but broken game loops\n4. Commit discipline inversely tracked with output quality in this round\n\n**Led to:**\n- Requirements v3 with explicit game-loop gate, spell-crafting gate, UI quality gate\n- Human_review weight raised from 0.15 to 0.30 with low-score caps\n- Skills must capture failure modes and fixes, not just patterns\n\n---"
  },
  {
    "round": "Round 3",
    "title": "Greenfield, three-condition, requirements v3",
    "body": "**Date:** 2026-04-08\n**Requirements version:** v3 (game-loop gate, spell-crafting gate, UI quality gate)\n**Conditions:** GAD v8, Bare v3, Emergent v2\n**Note:** All three hit rate limits mid-run\n\n**Results:**\n| Condition | Tokens | Commits | Human | Composite | Notes |\n|-----------|--------|---------|-------|-----------|-------|\n| **Bare v3** | 1877 | 1 batch | **0.70** | 0.526 | **Best game overall** — best UI/UX, most enjoyable. ASCII for some menus. |\n| Emergent v2 | 1609 | 2 phases | 0.50 | 0.478 | Functional forge with authored content. Medium UI. Maintained discipline under pressure. |\n| GAD v8 | 1291 | 0 | 0.20 | 0.177 | Broken crafting, old ASCII design. Never committed anything (rate limit hit mid-task). |\n\n**Key findings — the Freedom Hypothesis:**\n- Bare (no framework) consistently outperforms GAD (full framework) on creative implementation\n- GAD has never exceeded 0.30 human review across 4 attempts (v5, v6, v7, v8)\n- Bare has improved monotonically: 0.10 → 0.50 → 0.70\n- **Process metrics ≠ output quality.** GAD's planning overhead consumes tokens that\n  could go to testing and fixing the game.\n- Under rate-limit pressure, emergent maintained phase commits (inherited skill)\n  while bare regressed to 1 batch commit\n\n**Status of hypothesis:** PRELIMINARY — single-run variance is high, needs more trials.\nBrownfield experiments may invalidate if GAD's overhead pays off on codebase extension.\n\n**Documented in:** `evals/FINDINGS-2026-04-08-round-3.md`\n**Decision:** gad-36 (Freedom hypothesis)\n\n**Led to:**\n- Eval preservation contract (gad-38)\n- game/.planning/ layout mandate (gad-39)\n- Brownfield eval mode (gad-40)\n- Greenfield/brownfield categorization\n- `gad eval preserve`, `gad eval verify`, `gad worktree` commands\n\n---"
  },
  {
    "round": "Round 4",
    "title": "Greenfield, three-condition, requirements v4 (pressure-oriented)",
    "body": "**Date:** 2026-04-09\n**Requirements version:** v4 (pressure over features, authored-only, 4 gates including forge-with-ingenuity-payoff and pressure-mechanics)\n**Conditions:** GAD v10, Bare v5, Emergent v4 — run serially after round 3's parallel attempt hit the shared account rate limit (gad-62)\n**Framework versioning:** first round under trace schema v4 with hook-captured events (phase 25). Framework version stamped on every TRACE.json.\n\n**Results:**\n\n| Condition | Version | Human (rubric) | Composite | Notes |\n|-----------|---------|----------------|-----------|-------|\n| **Bare v5** | v5 | TBD | TBD | Complete playable game against v4 pressure requirements. DOM + iconify-icon + @iconify-json/game-icons. 2 floors × 8 rooms. |\n| **Emergent v4** | v4 | **0.805** (rubric aggregate) | TBD | Complete playable, \"incredible\" book-like UI, DoT/resistance/stacking mechanics, first observed full skill ratcheting cycle — authored dom-over-kaplay + pressure-forge-coupling + CHANGELOG. 6-dimension rubric including skill_inheritance_effectiveness 0.95. |\n| **GAD v10** | v4 | **0.02** (rubric aggregate) | — | **API-interrupted** (HTTP 529 overloaded_error, gad-64). Title screen rendered with a novel visual treatment (ui_polish 0.10) but planning phase crashed before scene implementation. Excluded from cross-round quality comparisons per gad-63 + gad-64. |\n| GAD v9 | v4 | 0.05 (legacy score) | — | Rate-limited during round 4 attempt #1 (parallel). Start screen only. Excluded from cross-round quality. |\n\n**Key findings — freedom hypothesis holds under v4:**\n- Under pressure-oriented v4 requirements, Bare + Emergent both shipped complete playable games; GAD was api-interrupted before implementation. Freedom hypothesis (gad-36) still holds, now with v4 as the stricter test.\n- **First observed full skill ratcheting cycle.** Emergent v4 inherited from emergent v3, authored 2 new project-tailored skills (dom-over-kaplay, pressure-forge-coupling), documented the disposition of each inherited skill in CHANGELOG.md, and deprecated kaplay-scene-pattern as unusable under DOM architecture. This is the first round where the compound-skills hypothesis (gad-65) has evidence to evaluate.\n- **Convergent design evolution.** All three conditions independently chose DOM + iconify-icon + @iconify-json/game-icons + per-floor forced-craft encounters, suggesting v4's pressure requirements are narrow enough to collapse the solution space regardless of framework.\n- **Rubric replaces single-score human review** (phase 27 track 1, gad-61). Emergent gets a 6th dimension `skill_inheritance_effectiveness` as the CSH test signal.\n\n**User playtest captured 12 v5 requirements** (`evals/_v5-requirements-addendum.md`): training-via-encounter, rune discovery loop, merchants, NPC dialogue, inventory/equipment + skill tree, spell/skill loadout slots, end-boss reachability, save checkpoints, notification lifecycle, rest rooms actually rest, 2D map navigation.\n\n**Documented in:**\n- `evals/FINDINGS-2026-04-09-round-4-complete.md`\n- `evals/FINDINGS-2026-04-09-round-4-partial.md`\n- `evals/_v5-requirements-addendum.md`\n\n**Decisions landed this round:** gad-61 (programmatic eval priority), gad-62 (serial default), gad-63 (rate-limited preserve-but-exclude), gad-64 (api-interrupted as distinct failure category), gad-65 (compound-skills hypothesis), gad-66 (authored-content injection experiment queued), gad-67 (serial as permanent default).\n\n**Led to:**\n- v5 requirements addendum (12 new/changed requirements from playtest)\n- Phase 27 rubric shipping (per-dimension scoring, RubricRadar SVG, /rubric page)\n- gad-66 content-pack extraction experiment\n- HTTP 529 investigation queued before GAD v11 retry (task 21-23b)\n- Serial-only execution as permanent default (gad-67)\n\n---"
  }
];

export const FINDINGS_ROUND_3_RAW: string | null = "# Round 3 Findings — Freedom Hypothesis\r\n\r\n**Requirements version:** v3 (game-loop gate, spell-crafting gate, UI quality gate)\r\n**Date:** 2026-04-08\r\n**Conditions:** GAD v8, Bare v3, Emergent v2 — all hit rate limits but produced builds\r\n\r\n## Results — inverted from expectations\r\n\r\n| Condition | Framework constraint | Tokens | Commits | Human score | Notes |\r\n|-----------|---------------------|--------|---------|-------------|-------|\r\n| **Bare v3** | **None (most freedom)** | 1,877 | 1 batch | **0.70** | Best UI/UX by far, most enjoyable |\r\n| Emergent v2 | Medium (inherited skills) | 1,609 | 2 phases | 0.50 | Solid forge, more content, maintained discipline |\r\n| GAD v8 | Full framework | 1,291 | 0 | 0.20 | Broken crafting, ASCII UI, hard to read |\r\n\r\n**The result is monotonic and inverse to framework constraint.** More freedom = better output.\r\n\r\n## Running tally across all rounds\r\n\r\n| Run | Requirements | Human | Key observation |\r\n|-----|-------------|-------|----------------|\r\n| GAD v5 | v1 | 0.00 | Blank screen |\r\n| GAD v6 | v2 | 0.00 | Blank screen |\r\n| GAD v7 | v2 | 0.30 | Stuck after combat |\r\n| **GAD v8** | **v3** | **0.20** | Broken crafting |\r\n| Bare v1 | v2 | 0.10 | New Game broken |\r\n| Bare v2 | v2 | 0.50 | Playable, ASCII UI |\r\n| **Bare v3** | **v3** | **0.70** | **Best game overall** |\r\n| Emergent v1 | v2 | 0.10 | Styled text crash |\r\n| **Emergent v2** | **v3** | **0.50** | Functional forge, medium UI |\r\n\r\n**GAD has never exceeded 0.30 human review across 4 attempts.**\r\n**Bare has improved monotonically: 0.10 → 0.50 → 0.70.**\r\n**Emergent has improved: 0.10 → 0.50.**\r\n\r\n## Freedom hypothesis\r\n\r\n> For creative/game implementation tasks, agent performance correlates INVERSELY with\r\n> framework constraint. Less prescribed structure leads to better output.\r\n\r\n### Supporting evidence\r\n\r\n1. **Bare always beats GAD** on human review, across all 3 rounds with same requirements\r\n2. **GAD has more tokens, more tool uses, more commits** — but produces worse games\r\n3. **GAD v8 had 0 commits** because it was so busy following the framework it hit the rate limit\r\n   before completing a work unit worth committing\r\n4. **Bare v3 best UI/UX** despite no framework telling it how to build UI\r\n5. **Emergent sits in the middle** — some framework, some freedom, middle results\r\n\r\n### Counter-evidence / confounds\r\n\r\n1. Rate limits hit all three runs — GAD v8 may have been about to commit when cut off\r\n2. Single-run variance is high — we haven't established statistical significance\r\n3. GAD's strength is discipline/traceability, not creative output — we may be measuring the\r\n   wrong thing for game evals\r\n4. Bare v3's \"one giant commit\" means if it had broken, there'd be no checkpoint. GAD's\r\n   discipline is insurance against catastrophic failure, not a booster for success\r\n\r\n### Alternative interpretation: the framework hurts speed\r\n\r\nGAD's planning overhead (reading/writing .planning/ docs, per-task commits, state updates,\r\ndecision capture) consumes tokens that could have gone to implementation and testing. In\r\na time-limited or token-limited environment, this overhead compounds:\r\n\r\n| Metric | GAD | Bare | Ratio |\r\n|--------|-----|------|-------|\r\n| Rounds completed with playable game | 0/4 | 2/3 | Bare 5x better |\r\n| Rounds with blank screen | 2/4 | 0/3 | GAD worse |\r\n| Rounds with gate failure | 4/4 | 1/3 | GAD worse |\r\n\r\n**GAD is producing disciplined garbage.** The process is followed but the product fails.\r\n\r\n## What this means for GAD\r\n\r\n1. **GAD may not be the right framework for creative implementation tasks.** It was designed\r\n   for planning/tracking, not for game development. Game dev rewards iteration speed and\r\n   visual feedback, which GAD's planning overhead slows down.\r\n\r\n2. **The bare condition's success suggests \"AGENTS.md + requirements + freedom\" is sufficient**\r\n   for implementation. The planning doc maintenance may be dead weight.\r\n\r\n3. **GAD's value proposition needs to be re-examined.** If process compliance doesn't correlate\r\n   with output quality, what is GAD actually optimizing for?\r\n   - Traceability across sessions (context compaction recovery)\r\n   - Multi-agent coordination\r\n   - Long-horizon planning (months, not days)\r\n   - Regulatory/compliance work where process matters\r\n\r\n4. **The game eval may be the wrong benchmark for GAD.** A better benchmark would be:\r\n   - Resuming work after context compaction\r\n   - Multi-phase refactors where state matters\r\n   - Documentation that has to be kept in sync with code\r\n   - Bug triage and root-cause analysis\r\n\r\n## Open questions\r\n\r\n1. Would GAD win if we measured context-resumption rather than fresh implementation?\r\n2. Does GAD win when the agent is replaced mid-run (simulating handoff)?\r\n3. What happens if we give Bare the same token budget as GAD's planning overhead in the form of free research time?\r\n4. Is the freedom hypothesis specific to KAPLAY/games, or does it generalize to web apps, APIs, CLIs?\r\n5. Would GAD do better with a \"lite mode\" that strips planning doc maintenance but keeps verification?\r\n\r\n## Immediate actions\r\n\r\n1. Treat this as a preliminary finding — needs more runs for statistical validity\r\n2. Create a GAD-lite mode for comparison (no per-task planning doc updates, only phase-level)\r\n3. Add a context-resumption eval where GAD's advantages should appear\r\n4. Do NOT abandon GAD — this finding may be specific to greenfield game implementation\r\n\r\n## Infrastructure findings\r\n\r\n- **Rate limits revealed discipline pressure response:** Emergent v2 was the only condition\r\n  that maintained phase commits under pressure. Bare regressed to 1 batch commit. GAD never\r\n  committed anything. Emergent's inherited skill \"game-loop-verification\" (which mandated\r\n  verify-per-phase) may have enforced a checkpoint discipline that kicked in before the limit.\r\n\r\n- **Build preservation was broken:** All previous runs overwrote the same path in\r\n  apps/portfolio/public/evals/. Now fixed — all 8 builds preserved per-version.\r\n";
export const FINDINGS_GENERAL_RAW: string | null = "# Eval Findings — 2026-04-08\n\n## Experiment: Escape the Dungeon — Three Conditions\n\n### Setup\n\nSame game requirements (12 criteria, vertical-slice priority, UI-first mandate), same source\ndocs (trimmed gameplay design ~120 lines), same stack (Vite + TypeScript + KAPLAY).\n\n| Condition | Framework | Skills | Runs |\n|-----------|-----------|--------|------|\n| GAD (escape-the-dungeon) | Full GAD: .planning/ XML, AGENTS.md loop, skill triggers | Pre-built | v5 (0.0), v6 (0.0), v7 (0.30) |\n| Bare (escape-the-dungeon-bare) | None — agent creates own workflow | From scratch | v1 (0.10), v2 (0.50) |\n| Emergent (escape-the-dungeon-emergent) | None — inherits skills from bare v1 | Inherited + evolves | v1 (0.10) |\n\n### Results: Human review scores\n\n| Run | Human | Notes |\n|-----|-------|-------|\n| GAD v5 | 0.00 | Blank screen |\n| GAD v6 | 0.00 | Blank screen (ES module + file://) |\n| GAD v7 | **0.30** | Renders, better UI layout, but game loop breaks after combat — player gets stuck |\n| Bare v1 | 0.10 | Main menu renders, New Game doesn't work |\n| Bare v2 | **0.50** | **Most playable.** Full game loop works. ASCII/plain UI, needs polish, no rune forge |\n| Emergent v1 | 0.10 | Main menu + saved game detection, but crashes entering game (styled text error) |\n\n### Key finding: Bare v2 beat GAD v7 on playability\n\nThe agent WITHOUT a framework produced the most playable game. This is a significant finding.\n\n**Why bare v2 won:**\n- Simpler architecture — fewer abstractions meant fewer places for bugs\n- Focused on making things work rather than following a process\n- 6 commits (phase-level granularity) — enough traceability without overhead\n- The feedback from v1's failure was more actionable than GAD's structural requirements\n\n**Why GAD v7 lost on playability despite better process metrics:**\n- 21 commits, 17/17 tasks tracked, full planning docs — excellent discipline\n- But the game loop broke (combat → no return to navigation)\n- More framework overhead (93K tokens vs 88K) didn't translate to better output\n- Planning docs were maintained perfectly while the actual game was broken\n- **The process was followed but the product was worse**\n\n### Token comparison\n\n| Run | Tokens | Tool uses | Commits | Human |\n|-----|--------|-----------|---------|-------|\n| Bare v1 | 67,751 | 62 | 2 | 0.10 |\n| Emergent v1 | 67,375 | 79 | 2 | 0.10 |\n| Bare v2 | 87,661 | 110 | 6 | **0.50** |\n| GAD v7 | 93,632 | 137 | 21 | 0.30 |\n\nGAD used 7% more tokens than bare v2 but scored 40% lower on human review. The token overhead\nof maintaining .planning/ docs did not pay for itself in output quality.\n\n### Emergent v1 findings\n\nThe emergent eval (inherited skills from bare v1) performed WORSE than both bare v2 and GAD v7.\nThis challenges the hypothesis that inherited skills improve outcomes.\n\n**Why emergent v1 failed:**\n- Inherited skills were code-level patterns, not workflow fixes\n- The `previous-workflow.md` told it v1's New Game was broken, but the fix didn't work\n- \"Styled text error: unclosed tags START\" — a KAPLAY API issue the skills didn't cover\n- Fewer tokens (67K) suggests it relied on inherited knowledge but that knowledge was insufficient\n\n**Lesson:** Skills need to capture failure modes and fixes, not just patterns. The bare v2 agent\nsucceeded because it was told \"v1's New Game was broken\" and had to figure out the fix itself.\nThe emergent agent was told the same thing AND given skills, but the skills didn't help with\nthe specific KAPLAY API issue that caused the crash.\n\n### What this means for GAD\n\n1. **Process metrics ≠ output quality.** GAD v7 had near-perfect discipline (0.81) and planning\n   quality (1.0) but produced a worse game than the undisciplined bare v2.\n\n2. **The framework adds overhead that doesn't always pay off.** 93K tokens for GAD vs 88K for\n   bare, with worse results. The planning doc maintenance consumed tokens that could have gone\n   to testing and fixing the game.\n\n3. **Feedback about failures is more valuable than inherited skills.** Bare v2 (told about v1's\n   failure) outperformed emergent v1 (given v1's skills + failure notes). Direct feedback\n   about what broke was more actionable than documented patterns.\n\n4. **Human review is the only metric that matters for game evals.** Auto-composite can be\n   0.95+ while the game is a blank screen. The gate criteria help but aren't sufficient —\n   a game can render and still be broken.\n\n### Requirements versioning\n\nRequirements have been updated twice this session:\n- **v1 (original):** 12 criteria focused on systems completeness\n- **v2 (current):** Gate criteria (must render, must be playable), vertical-slice priority,\n  UI-first build order. Trimmed source docs from 640 → 127 lines.\n\nNext iteration should add:\n- Explicit game-loop verification: title → new game → room → interaction → room (full cycle)\n- UI quality baseline: minimum spacing, readable text, no overlapping elements\n- Rune forge as a required criterion (currently missing from all implementations)\n\n### Open questions\n\n1. Would GAD do better if the AGENTS.md mandated explicit game-loop testing per phase?\n2. Would the emergent eval improve if skills captured KAPLAY-specific error fixes?\n3. Is the bare approach inherently better for creative/game implementation, or was this specific to KAPLAY?\n4. Would multiple bare v2 runs cluster around 0.50, or was this a lucky outlier?\n";

export const EVAL_PROJECTS: EvalProjectMeta[] = [
  {
    "id": "cli-efficiency",
    "name": "cli-efficiency",
    "description": "Measures token efficiency of gad CLI vs raw file reads for coding agent context. Compares two workflows: (1) CLI-first using gad context/session/state/phases/tasks, (2) baseline grep+read pattern used by GSD/RP agents.",
    "evalMode": null,
    "workflow": null,
    "baseline": "v1",
    "constraints": {
      "local_only": true,
      "no_external_services": true
    },
    "scoringWeights": {
      "token_reduction": 0.4,
      "context_completeness": 0.35,
      "information_loss": 0.25
    },
    "humanReviewRubric": null
  },
  {
    "id": "escape-the-dungeon",
    "name": "escape-the-dungeon",
    "description": "Greenfield: agent builds the game from scratch using the full GAD framework",
    "evalMode": "greenfield",
    "workflow": "gad",
    "baseline": null,
    "constraints": {
      "uses_gad_framework": true,
      "starts_from_scratch": true
    },
    "scoringWeights": {
      "requirement_coverage": 0.15,
      "planning_quality": 0.15,
      "per_task_discipline": 0.15,
      "skill_accuracy": 0.1,
      "time_efficiency": 0.05,
      "human_review": 0.3
    },
    "humanReviewRubric": {
      "version": "v1",
      "dimensions": [
        {
          "key": "playability",
          "label": "Playability",
          "weight": 0.3,
          "description": "Does the game run end-to-end? Title → new game → rooms → combat → return → continue. No softlocks. Inputs responsive."
        },
        {
          "key": "ui_polish",
          "label": "UI polish",
          "weight": 0.2,
          "description": "Does the UI feel intentional? Icons, HP/mana bars, room-type visual differentiation, styled controls. Not raw ASCII or debug panels."
        },
        {
          "key": "mechanics_implementation",
          "label": "Mechanics implementation",
          "weight": 0.2,
          "description": "Are the declared mechanics (combat, forge, rune crafting, resistances) functional and coherent? Do they match the design doc?"
        },
        {
          "key": "ingenuity_requirement_met",
          "label": "Ingenuity requirement met",
          "weight": 0.2,
          "description": "v4 core principle: do starter abilities ACTUALLY feel insufficient? Does the forge produce spells that feel necessary rather than cosmetic? If you can reach floor 2 without crafting, the gate failed."
        },
        {
          "key": "stability",
          "label": "Stability",
          "weight": 0.1,
          "description": "Does the game crash? Do scene transitions leave stale state? Does save/load work? Can you finish a run start-to-end without reload?"
        }
      ]
    }
  },
  {
    "id": "escape-the-dungeon-bare",
    "name": "escape-the-dungeon-bare",
    "description": "Greenfield baseline: agent builds the game WITHOUT a planning framework, creating its own workflow",
    "evalMode": "greenfield",
    "workflow": "bare",
    "baseline": null,
    "constraints": {
      "uses_gad_framework": false,
      "starts_from_scratch": true,
      "agent_creates_own_workflow": true
    },
    "scoringWeights": {
      "requirement_coverage": 0.2,
      "implementation_quality": 0.2,
      "workflow_emergence": 0.15,
      "iteration_evidence": 0.1,
      "time_efficiency": 0.05,
      "human_review": 0.3
    },
    "humanReviewRubric": {
      "version": "v1",
      "dimensions": [
        {
          "key": "playability",
          "label": "Playability",
          "weight": 0.3,
          "description": "Does the game run end-to-end? Title → new game → rooms → combat → return → continue. No softlocks."
        },
        {
          "key": "ui_polish",
          "label": "UI polish",
          "weight": 0.2,
          "description": "Does the UI feel intentional? Icons, HP/mana bars, room-type differentiation, styled controls. No raw ASCII."
        },
        {
          "key": "mechanics_implementation",
          "label": "Mechanics implementation",
          "weight": 0.2,
          "description": "Are combat, forge, rune crafting, resistances functional and coherent?"
        },
        {
          "key": "ingenuity_requirement_met",
          "label": "Ingenuity requirement met",
          "weight": 0.2,
          "description": "v4 principle: do starter abilities feel insufficient? Is the forge necessary, not cosmetic?"
        },
        {
          "key": "stability",
          "label": "Stability",
          "weight": 0.1,
          "description": "Crashes? Stale state? Save/load works? Finish a run without reload?"
        }
      ]
    }
  },
  {
    "id": "escape-the-dungeon-emergent",
    "name": "escape-the-dungeon-emergent",
    "description": "Greenfield emergent: agent builds the game with skills inherited from previous bare/emergent runs. Tests whether self-created systems improve over iterations.",
    "evalMode": "greenfield",
    "workflow": "emergent",
    "baseline": null,
    "constraints": {
      "uses_gad_framework": false,
      "starts_from_scratch": true,
      "inherits_previous_skills": true,
      "agent_iterates_on_workflow": true
    },
    "scoringWeights": {
      "requirement_coverage": 0.2,
      "implementation_quality": 0.15,
      "skill_reuse": 0.15,
      "workflow_quality": 0.1,
      "iteration_evidence": 0.05,
      "time_efficiency": 0.05,
      "human_review": 0.3
    },
    "humanReviewRubric": {
      "version": "v1",
      "dimensions": [
        {
          "key": "playability",
          "label": "Playability",
          "weight": 0.25,
          "description": "Does the game run end-to-end? Title → new game → rooms → combat → return → continue. No softlocks."
        },
        {
          "key": "ui_polish",
          "label": "UI polish",
          "weight": 0.15,
          "description": "Does the UI feel intentional? Icons, HP/mana bars, room-type differentiation, styled controls. No raw ASCII."
        },
        {
          "key": "mechanics_implementation",
          "label": "Mechanics implementation",
          "weight": 0.15,
          "description": "Are combat, forge, rune crafting, resistances functional and coherent?"
        },
        {
          "key": "ingenuity_requirement_met",
          "label": "Ingenuity requirement met",
          "weight": 0.15,
          "description": "v4 principle: do starter abilities feel insufficient? Is the forge necessary, not cosmetic?"
        },
        {
          "key": "stability",
          "label": "Stability",
          "weight": 0.1,
          "description": "Crashes? Stale state? Save/load works? Finish a run without reload?"
        },
        {
          "key": "skill_inheritance_effectiveness",
          "label": "Skill inheritance effectiveness",
          "weight": 0.2,
          "description": "EMERGENT-SPECIFIC: did the agent productively apply inherited skills? Did it evolve or author new skills worth inheriting by the next run? Did CHANGELOG.md document the disposition of each inherited skill? This is the compound-skills hypothesis check — is the skill library compounding in usefulness?"
        }
      ]
    }
  },
  {
    "id": "etd-brownfield-bare",
    "name": "etd-brownfield-bare",
    "description": "Brownfield: extend bare v3 codebase with v4 features WITHOUT a planning framework",
    "evalMode": "brownfield",
    "workflow": "bare",
    "baseline": {
      "project": "escape-the-dungeon-bare",
      "version": "v3",
      "source": "evals/escape-the-dungeon-bare/v3/run/"
    },
    "constraints": {
      "uses_gad_framework": false,
      "starts_from_existing_codebase": true,
      "agent_creates_own_workflow": true
    },
    "scoringWeights": {
      "requirement_coverage": 0.2,
      "implementation_quality": 0.2,
      "workflow_emergence": 0.15,
      "iteration_evidence": 0.1,
      "time_efficiency": 0.05,
      "human_review": 0.3
    },
    "humanReviewRubric": null
  },
  {
    "id": "etd-brownfield-emergent",
    "name": "etd-brownfield-emergent",
    "description": "Brownfield emergent: extend bare v3 codebase with v4 features, inheriting skills from previous emergent runs",
    "evalMode": "brownfield",
    "workflow": "emergent",
    "baseline": {
      "project": "escape-the-dungeon-bare",
      "version": "v3",
      "source": "evals/escape-the-dungeon-bare/v3/run/"
    },
    "constraints": {
      "uses_gad_framework": false,
      "starts_from_existing_codebase": true,
      "inherits_previous_skills": true,
      "agent_iterates_on_workflow": true
    },
    "scoringWeights": {
      "requirement_coverage": 0.2,
      "implementation_quality": 0.15,
      "skill_reuse": 0.15,
      "workflow_quality": 0.1,
      "iteration_evidence": 0.05,
      "time_efficiency": 0.05,
      "human_review": 0.3
    },
    "humanReviewRubric": null
  },
  {
    "id": "etd-brownfield-gad",
    "name": "etd-brownfield-gad",
    "description": "Brownfield: extend bare v3 codebase with v4 features using the full GAD framework",
    "evalMode": "brownfield",
    "workflow": "gad",
    "baseline": {
      "project": "escape-the-dungeon-bare",
      "version": "v3",
      "source": "evals/escape-the-dungeon-bare/v3/run/"
    },
    "constraints": {
      "uses_gad_framework": true,
      "starts_from_existing_codebase": true
    },
    "scoringWeights": {
      "requirement_coverage": 0.15,
      "planning_quality": 0.15,
      "per_task_discipline": 0.15,
      "skill_accuracy": 0.1,
      "time_efficiency": 0.05,
      "human_review": 0.3
    },
    "humanReviewRubric": null
  },
  {
    "id": "gad-planning-loop",
    "name": "gad-planning-loop",
    "description": "GAD self-evaluation: measures planning loop fidelity across a phase",
    "evalMode": null,
    "workflow": null,
    "baseline": null,
    "constraints": null,
    "scoringWeights": null,
    "humanReviewRubric": null
  },
  {
    "id": "planning-migration",
    "name": "planning-migration",
    "description": "Lossless migration of all vendor project .planning/ dirs and portfolio planning sink to unified GAD format. Evaluates format compliance, sink sync, trace coverage, and data preservation across the compile/decompile round-trip.",
    "evalMode": null,
    "workflow": null,
    "baseline": "planning-sink-backup-20260404",
    "constraints": null,
    "scoringWeights": null,
    "humanReviewRubric": null
  },
  {
    "id": "portfolio-bare",
    "name": "portfolio-bare",
    "description": "Portfolio monorepo planning eval. Agent opens a fresh template directory, plans and executes phases from requirements, declares context mode (fresh/loaded) at session start. Runs accumulate over time — context_delta emerges from the comparison.",
    "evalMode": null,
    "workflow": null,
    "baseline": "v1",
    "constraints": {
      "planning_only": true,
      "no_app_code": true,
      "no_external_services": true
    },
    "scoringWeights": {
      "requirement_coverage": 0.4,
      "task_alignment": 0.25,
      "state_hygiene": 0.2,
      "decision_coverage": 0.15
    },
    "humanReviewRubric": null
  },
  {
    "id": "project-migration",
    "name": "project-migration",
    "description": "Measures quality and completeness of migrating a project from a legacy planning framework (RP) to GAD. Scores planning continuity, skill coverage, and context efficiency before and after.",
    "evalMode": null,
    "workflow": null,
    "baseline": null,
    "constraints": null,
    "scoringWeights": null,
    "humanReviewRubric": null
  },
  {
    "id": "subagent-utility",
    "name": "subagent-utility",
    "description": "Formal evaluation of subagent utility vs single-session — informs gad-16 revision",
    "evalMode": null,
    "workflow": null,
    "baseline": null,
    "constraints": null,
    "scoringWeights": null,
    "humanReviewRubric": null
  }
];

export const PRODUCED_ARTIFACTS: Record<string, ProducedArtifacts> = {
  "escape-the-dungeon/v7": {
    "skillFiles": [],
    "agentFiles": [],
    "planningFiles": [
      {
        "name": "ARCHITECTURE.md",
        "bytes": 3424
      },
      {
        "name": "VERIFICATION.md",
        "bytes": 1069
      }
    ],
    "workflowNotes": []
  },
  "escape-the-dungeon/v9": {
    "skillFiles": [],
    "agentFiles": [],
    "planningFiles": [
      {
        "name": "source-STAT-AND-BEHAVIOUR-TAXONOMY.md",
        "bytes": 4628
      },
      {
        "name": "VERIFICATION.md",
        "bytes": 154
      }
    ],
    "workflowNotes": []
  },
  "escape-the-dungeon-bare/v1": {
    "skillFiles": [],
    "agentFiles": [],
    "planningFiles": [],
    "workflowNotes": [
      {
        "name": "WORKFLOW.md",
        "bytes": 3110
      }
    ]
  },
  "escape-the-dungeon-bare/v2": {
    "skillFiles": [],
    "agentFiles": [],
    "planningFiles": [],
    "workflowNotes": [
      {
        "name": "WORKFLOW.md",
        "bytes": 2751
      }
    ]
  },
  "escape-the-dungeon-bare/v3": {
    "skillFiles": [],
    "agentFiles": [],
    "planningFiles": [],
    "workflowNotes": [
      {
        "name": "WORKFLOW.md",
        "bytes": 1493
      }
    ]
  },
  "escape-the-dungeon-bare/v4": {
    "skillFiles": [
      {
        "name": "create-skill.md",
        "bytes": 5012
      },
      {
        "name": "find-sprites.md",
        "bytes": 6073
      }
    ],
    "agentFiles": [],
    "planningFiles": [
      {
        "name": "worklog.md",
        "bytes": 745
      }
    ],
    "workflowNotes": []
  },
  "escape-the-dungeon-bare/v5": {
    "skillFiles": [
      {
        "name": "create-skill.md",
        "bytes": 5012
      },
      {
        "name": "find-sprites.md",
        "bytes": 6073
      }
    ],
    "agentFiles": [],
    "planningFiles": [
      {
        "name": "worklog.md",
        "bytes": 3283
      }
    ],
    "workflowNotes": []
  },
  "escape-the-dungeon-emergent/v2": {
    "skillFiles": [],
    "agentFiles": [],
    "planningFiles": [],
    "workflowNotes": [
      {
        "name": "WORKFLOW.md",
        "bytes": 1163
      }
    ]
  },
  "escape-the-dungeon-emergent/v3": {
    "skillFiles": [
      {
        "name": "content-pack-loading.md",
        "bytes": 1370
      },
      {
        "name": "create-skill.md",
        "bytes": 5012
      },
      {
        "name": "find-sprites.md",
        "bytes": 6073
      },
      {
        "name": "game-loop-verification.md",
        "bytes": 1696
      },
      {
        "name": "kaplay-scene-pattern.md",
        "bytes": 1689
      },
      {
        "name": "previous-workflow.md",
        "bytes": 2951
      },
      {
        "name": "state-composition.md",
        "bytes": 1129
      }
    ],
    "agentFiles": [],
    "planningFiles": [],
    "workflowNotes": []
  },
  "escape-the-dungeon-emergent/v4": {
    "skillFiles": [
      {
        "name": "CHANGELOG.md",
        "bytes": 4917
      },
      {
        "name": "content-pack-loading.md",
        "bytes": 1370
      },
      {
        "name": "create-skill.md",
        "bytes": 5012
      },
      {
        "name": "dom-over-kaplay.md",
        "bytes": 3096
      },
      {
        "name": "find-sprites.md",
        "bytes": 6073
      },
      {
        "name": "game-loop-verification.md",
        "bytes": 1696
      },
      {
        "name": "kaplay-scene-pattern.md",
        "bytes": 1689
      },
      {
        "name": "pressure-forge-coupling.md",
        "bytes": 3377
      },
      {
        "name": "previous-workflow.md",
        "bytes": 2951
      },
      {
        "name": "state-composition.md",
        "bytes": 1129
      }
    ],
    "agentFiles": [],
    "planningFiles": [],
    "workflowNotes": []
  }
};

export const PLAYABLE_INDEX: Record<string, string> = {
  "escape-the-dungeon/v10": "/playable/escape-the-dungeon/v10/index.html",
  "escape-the-dungeon/v6": "/playable/escape-the-dungeon/v6/index.html",
  "escape-the-dungeon/v7": "/playable/escape-the-dungeon/v7/index.html",
  "escape-the-dungeon/v8": "/playable/escape-the-dungeon/v8/index.html",
  "escape-the-dungeon/v9": "/playable/escape-the-dungeon/v9/index.html",
  "escape-the-dungeon-bare/v1": "/playable/escape-the-dungeon-bare/v1/index.html",
  "escape-the-dungeon-bare/v2": "/playable/escape-the-dungeon-bare/v2/index.html",
  "escape-the-dungeon-bare/v3": "/playable/escape-the-dungeon-bare/v3/index.html",
  "escape-the-dungeon-bare/v4": "/playable/escape-the-dungeon-bare/v4/index.html",
  "escape-the-dungeon-bare/v5": "/playable/escape-the-dungeon-bare/v5/index.html",
  "escape-the-dungeon-emergent/v1": "/playable/escape-the-dungeon-emergent/v1/index.html",
  "escape-the-dungeon-emergent/v2": "/playable/escape-the-dungeon-emergent/v2/index.html",
  "escape-the-dungeon-emergent/v4": "/playable/escape-the-dungeon-emergent/v4/index.html"
};

export interface OpenQuestion {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  context: string;
  related_decisions: string[];
  related_requirements: string[];
  opened_on: string;
  resolved_on: string | null;
  resolution: string | null;
}

export interface BugRecord {
  id: string;
  title: string;
  project: string;
  version: string;
  observed_on: string;
  severity: string;
  status: string;
  description: string;
  expected: string;
  reproduction: string;
  related_requirement?: string;
  related_runs?: Array<{ project: string; version: string }>;
}

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    "id": "pressure-score-formula",
    "title": "How do we compute a pressure score per eval operationally?",
    "category": "evaluation",
    "status": "open",
    "priority": "critical",
    "context": "Decision gad-75 names pressure as a first-class eval dimension with five sub-dimensions (requirement complexity, ambiguity, constraint density, iteration budget, failure cost). The dimensions are named; the formula is not. Open questions: (a) is pressure a single aggregate score or a 5-tuple? (b) is it self-rated by the requirements author or programmatically extracted? (c) if programmatic, which fields in REQUIREMENTS.xml feed which sub-dimension? (d) does pressure live on requirements (per version) or on runs (per execution), or both? (e) how do we validate that our pressure rating matches agent-experienced pressure — probably by correlating rating against tool_uses-to-failure ratio. Candidate first-pass: self-rated 0.0-1.0 per sub-dimension on each requirements version (stored in REQUIREMENTS-VERSIONS.md and in a new <pressure-profile> block in REQUIREMENTS.xml), aggregated as a weighted sum, displayed on the /roadmap timeline as a pressure-tier progression across rounds.",
    "related_decisions": [
      "gad-75",
      "gad-72"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "pressure-as-rubric-vs-metadata",
    "title": "Should pressure become a scored rubric dimension or stay as test-condition metadata?",
    "category": "evaluation",
    "status": "discussing",
    "priority": "high",
    "context": "Pressure is CURRENTLY framed in gad-75 as metadata about the test conditions, not a measurement of the result. But there's a parallel interpretation: pressure could be scored — 'did the agent handle the pressure well'. That scoring collapses pressure into the existing rubric as a new dimension. The two framings answer different questions: metadata-pressure lets us normalize cross-round comparisons ('X scored 0.8 at pressure 0.6 vs Y scored 0.7 at pressure 0.9'), scored-pressure lets us rank agents on pressure-handling ability directly. Probably both are useful and we need both — one stored in REQUIREMENTS/TRACE metadata and one computed as a derived dimension. But committing to one framing first matters for the /roadmap page design and for any comparison visualization.",
    "related_decisions": [
      "gad-75"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "fresh-clone-contribution-test",
    "title": "Does a fresh clone of the repo actually work end-to-end for a human contributor?",
    "category": "framework",
    "status": "open",
    "priority": "high",
    "context": "Per decision gad-77, before the /contribute page ships we need to verify: (a) cloning the repo into a new directory results in a working agent environment (skills in .claude/, agents installed, commands available), (b) opening the repo in Claude Code surfaces the GAD skills to the agent without additional setup, (c) a conversational request like 'run the escape-the-dungeon-bare eval' actually works with no manual snapshot or XML editing. This is an untested assumption right now — we've been running agents in the canonical development repo where everything is already wired up. A fresh clone might hit missing .claude/settings.json entries, missing hook handler paths, missing env vars, or installer bugs. Until this is tested, /contribute is vaporware.",
    "related_decisions": [
      "gad-77"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "fundamental-skills-triumvirate",
    "title": "Do we already have create-skill / merge-skill / find-skills as fundamentals, and if not, should we build them?",
    "category": "framework",
    "status": "open",
    "priority": "high",
    "context": "User's vision (decision gad-73): GAD provides three fundamental skills as the foundation of emergent evolution. find-skills locates a trusted GAD fundamental (e.g. 'scientific method', 'debug'). merge-skill fuses that fundamental into a project-tailored skill (e.g. 'scientific-method-for-kaplay-rune-spellcrafting'). create-skill authors genuinely new ones when no merge candidate exists. This triumvirate IS the in-game rune/spell merging mechanic made meta. We need to audit what exists today in skills/ — create-skill likely already exists, merge-skill and find-skills may not. Reference: https://skills.sh/vercel-labs/skills/find-skills. GAD's version scopes to trusted ecosystem initially. Bigger ambition: prove skill effectiveness + provide skill security.",
    "related_decisions": [
      "gad-70",
      "gad-73"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "gad-value-prop-landing-page-framing",
    "title": "Should the landing page stop leading with 'ship software faster' and lead with task-management + skill evaluation instead?",
    "category": "site",
    "status": "resolved",
    "priority": "high",
    "context": "Per decision gad-74, GAD's actual value is not 'ship production software faster' — the freedom hypothesis already shows bare can outperform on creative implementation. Real value: (1) durable task management at scale with everything in-repo (no external DB, no lock-in), (2) scientific framework for proving skill effectiveness + workflow discipline, (3) skill security posture (longer-term). Landing page should reframe around these. Current landing hero is implicitly still about 'use GAD to build things' — it should be 'use GAD to understand whether agents are actually building things well.'",
    "related_decisions": [
      "gad-74",
      "gad-76"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": "2026-04-09",
    "resolution": "Resolved by decision gad-76 and the landing rewrite shipped in the 2026-04-09 IA session. New value-prop line: 'A system for evaluating and evolving agents through real tasks, measurable pressure, and iteration.' Landing primary CTA is now Play (B), above-the-fold stack is Play → Methodology → Findings → Hypothesis → Fork. Target audience is primarily coding-agent researchers (A) with indie devs (C) as experiential secondary entry. Pressure (gad-75) is introduced as the hook that differentiates GAD from other coding-agent frameworks."
  },
  {
    "id": "skill-security-model",
    "title": "What does 'skill security' actually look like in practice?",
    "category": "framework",
    "status": "open",
    "priority": "medium",
    "context": "User wants GAD to eventually provide a trust model for skills — how can you tell if a skill you're about to inherit is safe, effective, and actually improves anything? Initial thoughts: (a) frontmatter signing / checksum, (b) provenance lineage (which run authored it, which rubric scores validated it, which other runs inherited it successfully), (c) automated review against Anthropic's skills guide (gad-70), (d) sandboxed trial run in a throwaway worktree before trusting. Distinct from typosquatting defense (which lives in the planned /security page). This is about effectiveness + integrity, not name collisions.",
    "related_decisions": [
      "gad-70",
      "gad-73",
      "gad-74"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "csh-vs-freedom-which-wins-over-time",
    "title": "Does compounding skill inheritance (CSH) eventually beat raw freedom (freedom hypothesis) across many rounds?",
    "category": "hypothesis",
    "status": "open",
    "priority": "high",
    "context": "Round 4 produced a provocative finding: Emergent v4 scored 0.885 (with the 6-dim rubric including skill_inheritance_effectiveness), Bare v5 scored 0.805 (5-dim rubric), and GAD v10 was api-interrupted. On shared rubric dimensions (playability, ui_polish, mechanics, ingenuity, stability) Emergent beat Bare on playability and UI polish, tied on mechanics/ingenuity/stability. The freedom hypothesis (gad-36) says bare beats framework on creative output. The compound-skills hypothesis (gad-65) says emergent-with-evolution compounds over rounds. Round 4 may be the first evidence that CSH is overtaking freedom — BUT it's one round, rubric reweighting matters, and Emergent inherited from Bare so it has freedom-hypothesis lineage baked in. Need more rounds against v5 requirements to disambiguate.",
    "related_decisions": [
      "gad-36",
      "gad-65",
      "gad-68"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "programmatic-eval-gap-ranking",
    "title": "Which of our current eval metrics should become programmatic first?",
    "category": "evaluation",
    "status": "open",
    "priority": "critical",
    "context": "Per gad-69, every eval metric must answer 'can this be collected programmatically?' before 'how do we score it?'. We currently rely heavily on human review + agent self-report for: did the skill actually load, did the gate pass, is the forge integrated with pressure, is the game beatable. A programmatic-eval GAPS audit is queued as task 83 / task 96. The output should be .planning/GAPS.md ranking gaps by (a) how much human/agent judgment they currently require, (b) how mechanically checkable they actually are, (c) which phase picks them up. Highest candidates: playwright smoke tests for G1-G4 gates, hook-captured skill-trigger events, build/test exit codes as stability signals.",
    "related_decisions": [
      "gad-61",
      "gad-69"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "combat-model-a-vs-b",
    "title": "Should v5 mandate Unicorn-Overlord-style rule-based combat (Model A) or allow direct-control (Model B)?",
    "category": "game-design",
    "status": "discussing",
    "priority": "high",
    "context": "Bare v5 playtest surfaced a preference for rule-based simulated combat (loadout + spells + stats + action policies + initiative, chess-like positioning) over direct-control. R-v5.13 captures this as 'Model A preferred unless implementation exception granted.' Open question: is this the right call for round 5? Rule-based is harder to implement correctly in a single eval run and may advantage GAD's planning overhead (which would invalidate the freedom comparison if it's the reason bare underperforms next round).",
    "related_decisions": [
      "gad-36",
      "gad-68"
    ],
    "related_requirements": [
      "R-v5.13",
      "R-v5.14"
    ],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "content-pack-injection-baseline",
    "title": "How do we measure the value of authored-content-pack inheritance (gad-66) without confounding freedom/CSH tests?",
    "category": "evaluation",
    "status": "resolved",
    "priority": "medium",
    "context": "Decision gad-66 proposes an eval flavor that inherits pre-authored content (spells, runes, items, NPCs) alongside requirements. The user's goal is a 'really complex game made with all the builds and data around it.' But injecting content into a CSH-testing run would confound the compound-skills signal because the agent didn't author the content. Proposal: run it as a separate eval track (escape-the-dungeon-inherited-content) distinct from greenfield emergent, so CSH measurements stay clean. Still open: how do we compare a content-pack run to a greenfield run fairly?",
    "related_decisions": [
      "gad-65",
      "gad-66"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": "2026-04-09",
    "resolution": "Resolved: content-pack injection becomes its own eval track (separate from greenfield emergent) so CSH measurements stay clean. User reframed it as a *content-driven hypothesis* — analogous to making a game or movie derivative from a book. It is explicitly derivative work: not all processes are, 'much like a forger might not use the exact same brush.' This is a distinct hypothesis from freedom and CSH, with its own track, its own rounds, and its own comparison rules. We do NOT compare content-pack runs to greenfield runs on the same rubric — they answer different questions. The content-pack track's scoring focuses on: (a) does the extra content produce a more fleshed-out game given the same token budget, (b) does the agent integrate the content coherently rather than just bolting it on, (c) does the final game feel unified despite derivative source material."
  },
  {
    "id": "http-529-root-cause",
    "title": "What is the actual root cause of the HTTP 529 overloaded_error crashing GAD runs?",
    "category": "tooling",
    "status": "open",
    "priority": "high",
    "context": "GAD v10 was api-interrupted twice by HTTP 529 (once at tool_uses=18, then 55). This is distinct from account rate limits (gad-64). Per STATE.xml, investigation is queued before GAD v11 retry. Without understanding whether 529 correlates with high planning overhead (GAD-specific), payload size, tool-use frequency, or time of day, we can't plan round 5 reliably.",
    "related_decisions": [
      "gad-62",
      "gad-64"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "target-users-not-documented",
    "title": "Who exactly is the site + framework for?",
    "category": "site",
    "status": "open",
    "priority": "high",
    "context": "Task 90 queues ASSUMPTIONS.md. Without a documented target user, IA refactor decisions (task 84), skills directory UX (task 85), and landing-page framing will be ad-hoc. Candidates: coding-agent researchers, framework authors, indie devs exploring skill evolution, enterprise teams evaluating agent frameworks. Each implies a different navigation priority.",
    "related_decisions": [
      "gad-68"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "is-our-rubric-worth-its-ceiling",
    "title": "Is the 6th skill_inheritance_effectiveness dimension on emergent an unfair boost vs the 5-dim bare/gad rubric?",
    "category": "evaluation",
    "status": "discussing",
    "priority": "medium",
    "context": "Emergent v4 aggregate: 0.885. Bare v5 aggregate: 0.805. The 0.08 delta maps almost exactly to emergent's 6th-dimension contribution (skill_inheritance_effectiveness 0.95 * 0.20 weight = +0.19 against bare's absent-dimension 0). Shared-dimension comparison: emergent +0.18 playability, +0.10 ui_polish, tie on mechanics/ingenuity/stability. Is that 6th dimension double-counting emergent's inheritance advantage? Arguably yes — CSH is being tested by the existence of that dimension. Counter: without it, there's no way to score whether inheritance is actually working, which is the whole point of the emergent condition.",
    "related_decisions": [
      "gad-65"
    ],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  },
  {
    "id": "navigation-sprawl",
    "title": "How do we keep the site navigable as we add /security, /glossary, /roadmap, /skills-guide, /questions, /compare?",
    "category": "site",
    "status": "open",
    "priority": "high",
    "context": "Current nav already has 11 items (GAD, Lineage, Methodology, Rubric, Results, Graphs, Videos, Catalog, Findings, Planning, and now + Rubric). Tasks 86/87/88/95 will add more. Task 84 plans dropdown grouping + keyword search before more pages ship. Open: what is the grouping that makes sense to a first-time visitor vs a returning researcher?",
    "related_decisions": [],
    "related_requirements": [],
    "opened_on": "2026-04-09",
    "resolved_on": null,
    "resolution": null
  }
];

export const OPEN_QUESTIONS_UPDATED: string | null = "2026-04-09";

export const BUGS: BugRecord[] = [
  {
    "id": "rune-forge-same-rune-twice",
    "title": "Rune forge allows same rune twice in a single spell, boosts affinity twice",
    "project": "escape-the-dungeon-bare",
    "version": "v5",
    "observed_on": "2026-04-09",
    "severity": "medium",
    "status": "open",
    "description": "In the rune forge, the player can select the same rune twice as ingredients for a single spell. When crafted, the affinity gain for that rune is applied twice as if two distinct rune slots were consumed. The resulting spell also treats the duplicate as a meaningful second ingredient.",
    "expected": "Selecting a rune that is already in the current spell's ingredient list should either reject the second click or toggle that rune off. Affinity gain should be per-unique-rune-slot. Duplicate runes across DIFFERENT spells in the player's spellbook remain fine and are explicitly allowed.",
    "reproduction": "Open forge. Select Fire rune. Select Fire rune again. Craft. Observe that Fire affinity increases by 2x the normal amount for a single-rune craft.",
    "related_requirement": "R-v5.20",
    "related_runs": []
  },
  {
    "id": "notifications-persist-across-sessions",
    "title": "Toast notifications persist above the screen across new game sessions",
    "project": "escape-the-dungeon-emergent",
    "version": "v4",
    "observed_on": "2026-04-09",
    "severity": "medium",
    "status": "open",
    "description": "Notifications like 'trained fire affinity' appear and never auto-dismiss. Starting a new game does not clear the backlog; they remain above the latest build's UI.",
    "expected": "Every notification auto-dismisses after a short timeout (3-5s) or has an explicit close control. Starting a new game clears the notification queue. Page reload clears stale notifications.",
    "reproduction": "Play until a notification appears. Do not dismiss. Start a new game. Observe notification still overlays the new session.",
    "related_requirement": "R-v5.10",
    "related_runs": []
  },
  {
    "id": "continue-after-death-greyed-out",
    "title": "Continue button disabled after death — no save checkpoints",
    "project": "escape-the-dungeon-emergent",
    "version": "v4",
    "observed_on": "2026-04-09",
    "severity": "high",
    "status": "open",
    "description": "On player death the game ends and Continue is no longer selectable. No automatic checkpoint appears to have been created during the run.",
    "expected": "Room-clear or floor-clear creates a checkpoint. On death, Continue loads the most recent checkpoint.",
    "reproduction": "Start new game. Die in any encounter. Return to title. Continue is greyed out.",
    "related_requirement": "R-v5.09",
    "related_runs": []
  },
  {
    "id": "glitchy-button-click-redraws",
    "title": "Glitchy redraws on button clicks across all round-4 builds",
    "project": "escape-the-dungeon",
    "version": "v10",
    "observed_on": "2026-04-09",
    "severity": "medium",
    "status": "open",
    "description": "UI visibly glitches/flickers on button clicks as if full per-tick redraws are running. Observed consistently across GAD v9, GAD v10, Bare v5, and Emergent v4.",
    "expected": "Event-driven rendering only. No redraw loops firing at a fixed rate regardless of state changes. React/DOM reconciles on state change; requestAnimationFrame only runs when animation is active.",
    "reproduction": "Click any menu button in any round-4 build. Observe brief UI flicker.",
    "related_requirement": "R-v5.21",
    "related_runs": [
      {
        "project": "escape-the-dungeon",
        "version": "v9"
      },
      {
        "project": "escape-the-dungeon-bare",
        "version": "v5"
      },
      {
        "project": "escape-the-dungeon-emergent",
        "version": "v4"
      }
    ]
  }
];

export const BUGS_UPDATED: string | null = "2026-04-09";

export interface GlossaryTerm {
  id: string;
  term: string;
  aliases: string[];
  category: string;
  short: string;
  full: string;
  related_decisions: string[];
  related_terms: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    "id": "compound-skills-hypothesis",
    "term": "Compound-Skills Hypothesis",
    "aliases": [
      "CSH",
      "compound skills hypothesis"
    ],
    "category": "hypothesis",
    "short": "The working hypothesis that a coding agent's skill library compounds in value over many rounds as skills are merged and tailored to a specific project — like a master craftsman accumulating tools for their craft.",
    "full": "The Compound-Skills Hypothesis says the **emergent** eval condition should produce monotonically improving results as its inherited skill library grows more specialized to the project domain. The craftsman metaphor: a blacksmith who learns one skill per hour and authors one skill per hour eventually becomes a master of the specific kind of blade they keep forging. Signals we track: (1) human review score increases across rounds, (2) inherited skill count grows, (3) ratio of project-specific skills to generic methodology skills shifts toward specific, (4) time-to-working-game decreases as requirements get stricter. **Distinct from the freedom hypothesis** — CSH is about compounding returns over time, not about bare vs framework in a single round. First concrete evidence observed in round 4 with emergent v4 authoring `dom-over-kaplay` and `pressure-forge-coupling` skills while deprecating `kaplay-scene-pattern`.",
    "related_decisions": [
      "gad-65",
      "gad-68"
    ],
    "related_terms": [
      "freedom-hypothesis",
      "emergent-workflow",
      "skill-inheritance"
    ]
  },
  {
    "id": "freedom-hypothesis",
    "term": "Freedom Hypothesis",
    "aliases": [
      "freedom hyp",
      "freeform hypothesis"
    ],
    "category": "hypothesis",
    "short": "For creative implementation tasks, agent performance correlates INVERSELY with framework constraint — less prescribed structure leads to better output.",
    "full": "The Freedom Hypothesis emerged from round 3's finding that the bare eval condition (no framework) outperformed the GAD condition (full framework) on human review scores across multiple rounds. Supporting evidence: Bare has improved monotonically 0.10 → 0.50 → 0.70 → 0.805 across rounds 2-4. GAD has never exceeded 0.30 human review across its first four attempts. Interpretation: GAD's planning overhead consumes tokens that could have gone to testing and fixing the game. The hypothesis is **preliminary** — single-run variance is high and framework overhead may pay off on different benchmarks (resumption after compaction, multi-phase refactors, compliance work). The Compound-Skills Hypothesis was formulated partly as a response to this finding: maybe the framework compounds over rounds in ways a single round can't show.",
    "related_decisions": [
      "gad-36",
      "gad-68"
    ],
    "related_terms": [
      "compound-skills-hypothesis",
      "bare-workflow",
      "gad-workflow"
    ]
  },
  {
    "id": "emergent-evolution-hypothesis",
    "term": "Emergent-Evolution Hypothesis",
    "aliases": [
      "emergent evolution",
      "EEH"
    ],
    "category": "hypothesis",
    "short": "Synthesis of freedom + compound-skills + project-tailored merging. Projects are themselves emergent; skills must be tailored, merged, and rehearsed against a foundational pool.",
    "full": "Formal statement: a coding agent given (a) blank planning artifacts, (b) requirements, (c) the task, and (d) the ability to create, merge, and find skills from a GAD-provided foundational pool will produce better work than framework-constrained or bare conditions over time — because projects are themselves emergent, and skills must be tailored continually and merged with similar foundational skills to maintain consistency. The craftsman/lifter metaphor: a master lifter varies exercise and lowers weight to stay sharp, a craftsman returns to fundamentals to maintain form. GAD's role under this framing is NOT to prescribe process — it's to provide the foundational skill pool and an evolution substrate. This is the single most important research direction going forward.",
    "related_decisions": [
      "gad-68",
      "gad-73"
    ],
    "related_terms": [
      "freedom-hypothesis",
      "compound-skills-hypothesis",
      "fundamental-skills",
      "merge-skill"
    ]
  },
  {
    "id": "emergent-workflow",
    "term": "Emergent workflow",
    "aliases": [
      "emergent condition",
      "emergent eval"
    ],
    "category": "workflow",
    "short": "An eval condition where the agent has no mandated framework but inherits skills from previous runs, evolves them in place, and writes a CHANGELOG.",
    "full": "The emergent workflow is one of three eval conditions (alongside GAD and bare). The agent runs without a prescribed framework but starts with a skill library inherited from previous bare or emergent runs on the same project. The agent is allowed (and encouraged) to update, deprecate, or author new skills based on what it learned. A CHANGELOG.md tracks the disposition of every inherited skill: kept-as-is, evolved, deprecated-as-wrong, or replaced-by-new. This is the workflow that produces evidence for the Compound-Skills Hypothesis. First full ratcheting cycle observed in round 4 with emergent v4 authoring two new skills and deprecating one.",
    "related_decisions": [
      "gad-39",
      "gad-65",
      "gad-68"
    ],
    "related_terms": [
      "bare-workflow",
      "gad-workflow",
      "compound-skills-hypothesis",
      "skill-inheritance"
    ]
  },
  {
    "id": "bare-workflow",
    "term": "Bare workflow",
    "aliases": [
      "bare condition",
      "bare eval"
    ],
    "category": "workflow",
    "short": "An eval condition where the agent has no framework and no inherited skills — only AGENTS.md, requirements, and freedom.",
    "full": "The bare workflow is the simplest eval condition. The agent is given only requirements and an AGENTS.md directive to keep workflow artifacts under `game/.planning/` — nothing else. No framework, no skill library, no prescribed process. It exists to test the Freedom Hypothesis: can an unconstrained agent outperform a framework-driven one on creative implementation? As of round 4, the answer has been yes on human review scores, though the Emergent workflow has recently pulled ahead with its inherited skill library (round 4 emergent 0.885 vs bare 0.805).",
    "related_decisions": [
      "gad-36",
      "gad-39"
    ],
    "related_terms": [
      "emergent-workflow",
      "gad-workflow",
      "freedom-hypothesis"
    ]
  },
  {
    "id": "gad-workflow",
    "term": "GAD workflow",
    "aliases": [
      "gad condition",
      "full gad"
    ],
    "category": "workflow",
    "short": "An eval condition where the agent uses the full GAD framework — .planning/ XML, AGENTS.md loop, skill triggers, plan → execute → verify → commit.",
    "full": "The GAD workflow is the framework-driven eval condition. The agent follows the full GAD planning loop: read STATE, pick a task, implement, update planning docs, commit. It has access to the entire GAD skill library, the subagent system, and formal phase/task tracking. Across rounds 1-4, GAD has consistently produced high process discipline (planning quality ~1.0, commits-per-task ~1.0) but low human-review scores (never exceeded 0.30). This gap between process metrics and output quality led to the Freedom Hypothesis and is the core puzzle the Emergent-Evolution Hypothesis is trying to resolve.",
    "related_decisions": [
      "gad-01",
      "gad-36"
    ],
    "related_terms": [
      "bare-workflow",
      "emergent-workflow",
      "planning-loop"
    ]
  },
  {
    "id": "greenfield",
    "term": "Greenfield",
    "aliases": [
      "green field",
      "greenfield mode"
    ],
    "category": "evaluation",
    "short": "An eval mode where the agent builds a project from nothing — no existing codebase, just requirements and a starting template.",
    "full": "Greenfield is one of two eval modes (the other is brownfield). In greenfield mode, the agent starts with essentially nothing: a blank repo, a requirements document, and (depending on the workflow) either a full framework, a bare AGENTS.md, or an inherited skill library. The escape-the-dungeon game evals are all greenfield — each run builds the game from scratch. Greenfield tests the agent's ability to design and implement from zero. Compare with brownfield, which tests the agent's ability to extend and improve an existing codebase.",
    "related_decisions": [
      "gad-40"
    ],
    "related_terms": [
      "brownfield",
      "eval-run"
    ]
  },
  {
    "id": "brownfield",
    "term": "Brownfield",
    "aliases": [
      "brown field",
      "brownfield mode"
    ],
    "category": "evaluation",
    "short": "An eval mode where the agent inherits an existing codebase baseline and must extend or improve it against new requirements.",
    "full": "Brownfield is one of two eval modes (the other is greenfield). In brownfield mode, the eval starts with a baseline codebase — typically the output of a prior greenfield run — and asks the agent to extend it against new or expanded requirements. This tests a different set of skills: code archaeology, maintaining consistency with existing patterns, understanding why something was done before changing it. The brownfield etd-brownfield-gad/bare/emergent projects inherit bare v3 as their baseline. Brownfield is where framework-driven workflows (GAD) might show their value — long-term maintenance rather than one-shot creative output.",
    "related_decisions": [
      "gad-40"
    ],
    "related_terms": [
      "greenfield",
      "eval-run"
    ]
  },
  {
    "id": "gate",
    "term": "Gate criterion",
    "aliases": [
      "gate",
      "gates",
      "gate criteria"
    ],
    "category": "evaluation",
    "short": "A binary pass/fail requirement that, if failed, zeroes the requirement_coverage score regardless of other criteria met.",
    "full": "Gates are the load-bearing requirements every run must pass to be considered a serious attempt. Requirements v3 introduced four gates: G1 game-loop (full cycle title → new game → room → combat → return → continue), G2 forge-with-ingenuity-payoff (spell crafting exists AND at least one encounter per floor significantly favors crafted spells), G3 ui-quality (no raw ASCII, icons/bars/spacing intentional), G4 pressure-mechanics (at least 2 of resource/enemy/encounter/build pressure present). If any gate fails, requirement_coverage = 0 and the composite score is capped. Gates exist because automated requirement counting can hit 0.95 while the actual game is a blank screen.",
    "related_decisions": [
      "gad-32",
      "gad-33",
      "gad-41"
    ],
    "related_terms": [
      "rubric",
      "composite",
      "ingenuity"
    ]
  },
  {
    "id": "rubric",
    "term": "Rubric",
    "aliases": [
      "human review rubric",
      "review rubric"
    ],
    "category": "evaluation",
    "short": "A set of weighted dimensions a human reviewer scores 0.0 – 1.0 independently, summed to produce human_review.score.",
    "full": "The rubric replaces a single-number human review score with a per-dimension breakdown. Each eval project defines its own rubric in `gad.json` under `human_review_rubric`. Dimensions include playability, ui_polish, mechanics_implementation, ingenuity_requirement_met, stability. The Emergent workflow gets a sixth dimension, skill_inheritance_effectiveness, that specifically tests the Compound-Skills Hypothesis. A reviewer submits scores via `gad eval review <project> v<N> --rubric '{...}' --notes '...'`. The weighted aggregate becomes `human_review.score` in the composite formula. See the /rubric page for each project's full rubric.",
    "related_decisions": [
      "gad-61"
    ],
    "related_terms": [
      "composite",
      "human-review",
      "gate"
    ]
  },
  {
    "id": "composite",
    "term": "Composite score",
    "aliases": [
      "composite",
      "composite_score"
    ],
    "category": "evaluation",
    "short": "Weighted sum of dimension scores per project. Each project weights dimensions differently. Range 0.0 – 1.0.",
    "full": "Composite is the single derived number representing a run's overall quality. It's a weighted sum over a project's scoring dimensions — the weights live in `gad.json` under `scoring.weights`. Different projects weight differently: a tooling eval might weight time_efficiency highly; an implementation eval weights human_review at 0.30 to prevent process-metric-only wins. Gate failures cap the composite by zeroing requirement_coverage. Low-score caps: composite < 0.20 → 0.40, composite < 0.10 → 0.25. The composite is displayed on every run card and per-run page.",
    "related_decisions": [
      "gad-34"
    ],
    "related_terms": [
      "rubric",
      "gate",
      "divergence"
    ]
  },
  {
    "id": "ingenuity",
    "term": "Ingenuity",
    "aliases": [
      "ingenuity score",
      "ingenuity requirement"
    ],
    "category": "game-design",
    "short": "The v4 principle that baseline starter abilities must NOT be sufficient to complete a floor — the player must adapt, craft, or specialize.",
    "full": "Ingenuity is the core design principle of requirements v4. Every mechanical system must create friction that rewards creative player choice. If a player can brute-force a floor using only default abilities, the design has failed. The G2 forge gate expanded in v4 from 'crafting exists' to 'at least one encounter per floor significantly favors crafted/adapted spells.' In the rubric, ingenuity_requirement_met is a scored dimension that asks whether the player was FORCED to think. This is why round 4 surfaced the observation that Emergent v4's floor-1 is 'beatable only by skipping combat, gathering mana, crafting the right spells, then fighting the boss fresh' — that's ingenuity working as intended.",
    "related_decisions": [
      "gad-41",
      "gad-42"
    ],
    "related_terms": [
      "gate",
      "forge",
      "pressure-mechanics"
    ]
  },
  {
    "id": "forge",
    "term": "Rune forge",
    "aliases": [
      "forge",
      "spell crafting"
    ],
    "category": "game-design",
    "short": "The in-game spell-crafting interface where players combine runes (and eventually spells) to create new abilities.",
    "full": "The rune forge is the escape-the-dungeon spell-crafting system and the centerpiece of the G2 gate. Players select runes, combine them, and produce new spells. Requirements v4 requires at least 3-5 runes, 3+ valid combinations, and crucially, at least one encounter per floor where the crafted spell provides a meaningful advantage. v5 (addendum) expands the forge: spells themselves become craftable ingredients (R-v5.19), rune uniqueness per spell is enforced (R-v5.20), and affinity is gained through casting not menu training (R-v5.01). The forge is also an explicit in-game analogue for the GAD skill-merging meta-loop — merging runes into spells mirrors merging fundamental skills into project-tailored ones.",
    "related_decisions": [
      "gad-33",
      "gad-41"
    ],
    "related_terms": [
      "ingenuity",
      "gate",
      "affinity",
      "merge-skill"
    ]
  },
  {
    "id": "affinity",
    "term": "Rune affinity",
    "aliases": [
      "affinity"
    ],
    "category": "game-design",
    "short": "A per-rune progression stat gained by using that rune — higher affinity means stronger spells using it.",
    "full": "Rune affinity is how players specialize their magical build in escape-the-dungeon. In v4 and earlier, affinity gain was implementation-dependent; in v5 (addendum R-v5.01), affinity must be gained as a side effect of casting spells in encounters — not via a training menu. A training-dummy encounter room type provides a low-risk place to cast without consequence. v5 also requires a visible affinity reward loop (R-v5.16): boosting a rune's affinity must produce a visible, valuable payoff (new rune variant, spell tier, gated event access). Affinity is a build-pressure mechanic per G4.",
    "related_decisions": [],
    "related_terms": [
      "forge",
      "pressure-mechanics",
      "ingenuity"
    ]
  },
  {
    "id": "pressure-mechanics",
    "term": "Pressure mechanics",
    "aliases": [
      "pressure",
      "pressure mechanic"
    ],
    "category": "game-design",
    "short": "Systems that constrain player behavior so crafting or adapting spells provides a meaningful advantage.",
    "full": "Pressure mechanics are the v4 G4 gate. A passing game must include at least two of: (a) resource pressure — limited mana, limited healing, forge cost; (b) enemy counterplay — resistances, immunities, behavior that punishes repetition; (c) encounter design pressure — elites, bosses that invalidate default play, rooms with mechanical constraints; (d) build pressure — affinity pushes specialization, loadout limits force trade-offs. At least one pressure mechanic must interact with the forge so crafted spells are demonstrably more effective than defaults. Pressure is what makes the Ingenuity requirement bite — without pressure, ingenuity is optional.",
    "related_decisions": [
      "gad-41"
    ],
    "related_terms": [
      "gate",
      "ingenuity",
      "forge",
      "affinity"
    ]
  },
  {
    "id": "trace-schema-v4",
    "term": "Trace schema v4",
    "aliases": [
      "trace v4",
      "schema v4"
    ],
    "category": "infra",
    "short": "The current version of TRACE.json plus hook-captured event streams. Every tool use, skill invocation, subagent spawn, and file mutation is recorded.",
    "full": "Trace schema v4 is the instrumentation layer that makes programmatic evaluation possible. Every run produces a TRACE.json file with summary metrics plus a stream of events captured via Claude Code PreToolUse/PostToolUse hooks. Event types: tool_use, skill_invocation, subagent_spawn, file_mutation. Event output fields are capped at 4 KB with head/tail truncation; full output stays in Claude Code's session.jsonl for deeper inspection. The framework version is stamped on every TRACE so evals can be re-run across framework versions without contamination. All the programmatic-eval gaps in GAPS.md are built on top of this event stream.",
    "related_decisions": [
      "gad-50",
      "gad-51",
      "gad-53",
      "gad-58",
      "gad-60"
    ],
    "related_terms": [
      "hooks",
      "programmatic-eval"
    ]
  },
  {
    "id": "hooks",
    "term": "Hooks",
    "aliases": [
      "hook",
      "pretooluse hook",
      "posttooluse hook"
    ],
    "category": "infra",
    "short": "Claude Code PreToolUse/PostToolUse handlers that emit structured events into the trace stream.",
    "full": "Hooks are how we capture trace schema v4 events without modifying the agent itself. Claude Code's hook system fires on every tool use (before + after) and passes a JSONL payload on stdin. The GAD hook handler (vendor/get-anything-done/bin/gad-trace-hook.cjs) reads that payload and emits a structured event into the per-phase trace stream. The handler lives in the GAD repo so framework updates automatically propagate to any workspace that references it by absolute path in .claude/settings.json.",
    "related_decisions": [
      "gad-58",
      "gad-59"
    ],
    "related_terms": [
      "trace-schema-v4"
    ]
  },
  {
    "id": "rate-limited",
    "term": "Rate-limited",
    "aliases": [
      "rate limit",
      "rate limited run"
    ],
    "category": "evaluation",
    "short": "A run that hit an account-level token/request rate limit before completing. Preserved as a data point but excluded from cross-round quality comparisons.",
    "full": "When a run hits the Anthropic account rate limit mid-execution, it's marked `timing.rate_limited = true` in TRACE.json. The partial work is still preserved (it contains useful signal about planning differential, architecture patterns, inheritance effects) but is excluded from freedom-hypothesis comparisons, scatter plots, and cross-round quality aggregation. Rate limits forced the move to serial eval execution (gad-62 → gad-67) after round 3's parallel attempt lost all three runs simultaneously.",
    "related_decisions": [
      "gad-62",
      "gad-63",
      "gad-67"
    ],
    "related_terms": [
      "api-interrupted",
      "eval-run"
    ]
  },
  {
    "id": "api-interrupted",
    "term": "API-interrupted",
    "aliases": [
      "api interrupted",
      "529 interrupted"
    ],
    "category": "evaluation",
    "short": "A run that was interrupted by an Anthropic API server error (e.g. HTTP 529 overloaded_error). Different cause than rate limit, same exclusion policy.",
    "full": "Server-side transient errors (HTTP 529 overloaded_error being the most common) are distinct from account rate limits: different cause, different retry semantics, different interpretation. The TRACE.json flag `timing.api_interrupted = true` with an `interruption_note` field distinguishes them. Both rate-limited and api-interrupted runs are preserved-but-excluded. GAD v10 was api-interrupted twice; investigating the 529 pattern is a queued task before the GAD v11 retry.",
    "related_decisions": [
      "gad-64"
    ],
    "related_terms": [
      "rate-limited",
      "eval-run"
    ]
  },
  {
    "id": "eval-run",
    "term": "Eval run",
    "aliases": [
      "run",
      "eval version"
    ],
    "category": "evaluation",
    "short": "A single attempt by an agent to satisfy an eval's requirements. Identified by project + version, e.g. escape-the-dungeon-bare/v5.",
    "full": "An eval run is the atomic unit of evaluation. Each run produces a source tree, a build, a TRACE.json, and (ideally) a human review. Multiple runs can share a round (same requirements version) but differ in agent, workflow, or retry attempt. Runs are versioned monotonically per project: escape-the-dungeon-bare/v1, v2, ..., v5. Preserved runs land under evals/<project>/<version>/ and their builds under apps/portfolio/public/evals/<project>/<version>/. The preservation contract (gad-38) is enforced by tests.",
    "related_decisions": [
      "gad-37",
      "gad-38"
    ],
    "related_terms": [
      "greenfield",
      "brownfield",
      "round"
    ]
  },
  {
    "id": "round",
    "term": "Round",
    "aliases": [
      "eval round",
      "rounds"
    ],
    "category": "evaluation",
    "short": "A set of eval runs sharing the same requirements-document version. A new requirements version = a new round.",
    "full": "Per gad-72, a round is defined by its requirements-document version. Round 1 = requirements v1 = escape-the-dungeon v1-v5 runs. Round 2 = v2 = etd v6/v7 + bare v1/v2 + emergent v1. Round 3 = v3. Round 4 = v4. Multiple runs can live inside a single round (different workflows, retries). Rounds are progressively more complex — requirements expand monotonically. Earlier rounds can be re-evaluated with new hypotheses; a new hypothesis can start a new round against any requirements version (e.g. 'does codex cli build similarly to claude code against v4' is a valid new round against v4, producing a new line of data).",
    "related_decisions": [
      "gad-72"
    ],
    "related_terms": [
      "eval-run",
      "requirements-version"
    ]
  },
  {
    "id": "fundamental-skills",
    "term": "Fundamental skills",
    "aliases": [
      "fundamentals",
      "foundational skills",
      "triumvirate"
    ],
    "category": "framework",
    "short": "GAD's three foundational skills — create-skill, merge-skill, find-skills — that enable the emergent-evolution hypothesis to work.",
    "full": "Per gad-73, GAD provides a triumvirate of fundamental skills: find-skills (locate a trusted fundamental from the GAD ecosystem — like 'scientific-method' or 'debug'), merge-skill (fuse a fundamental into a project-attuned skill), and create-skill (author genuinely new skills when merging isn't possible). Together they let an emergent agent evolve its skill library across rounds by finding relevant fundamentals, tailoring them to the current project, and creating new primitives only when necessary. This is the meta-layer of the in-game rune/spell merging mechanic — the agent's skill library evolves via the same combine-fundamentals pattern the escape-the-dungeon game teaches players.",
    "related_decisions": [
      "gad-70",
      "gad-73"
    ],
    "related_terms": [
      "merge-skill",
      "emergent-workflow",
      "emergent-evolution-hypothesis"
    ]
  },
  {
    "id": "merge-skill",
    "term": "merge-skill",
    "aliases": [
      "skill merging",
      "skill merge"
    ],
    "category": "framework",
    "short": "A fundamental GAD skill that fuses a foundational skill (e.g. scientific-method) with a project context to produce a tailored variant.",
    "full": "merge-skill is one of the three fundamental skills (gad-73). Input: a foundational skill from the trusted pool + a project context. Output: a new skill that carries the foundational's rigor into the project's vocabulary. Example: merging 'scientific-method' into a kaplay rune-spellcrafting project produces 'scientific-method-for-kaplay-rune-spellcrafting' — same underlying practice, tailored examples, tailored pitfalls. This is how the emergent workflow is supposed to evolve: not by inventing new skills from scratch but by taking fundamentals and attuning them.",
    "related_decisions": [
      "gad-73"
    ],
    "related_terms": [
      "fundamental-skills",
      "emergent-workflow"
    ]
  },
  {
    "id": "programmatic-eval",
    "term": "Programmatic evaluation",
    "aliases": [
      "programmatic eval",
      "automated eval"
    ],
    "category": "evaluation",
    "short": "Eval metrics collected by tooling (hooks, traces, parsers) rather than by agent self-report or human judgment.",
    "full": "Per gad-69, every eval metric must answer 'can this be collected programmatically?' before 'how do we score it?'. The goal is to minimize agent-self-report (which is suspect) and minimize human-judgment (which doesn't scale) without sacrificing the dimensions that genuinely need a human. Current programmatic metrics: tool_use_mix, skill_to_tool_ratio, plan_adherence_delta, commit rhythm, produced_artifact_density. Gaps ranked in .planning/GAPS.md — the top three are skill-trigger coverage, build exit code, and skill-inheritance hygiene, all based on trace events rather than UI visual tests.",
    "related_decisions": [
      "gad-61",
      "gad-69"
    ],
    "related_terms": [
      "trace-schema-v4",
      "hooks",
      "rubric"
    ]
  },
  {
    "id": "pseudo-database",
    "term": "JSON pseudo-database",
    "aliases": [
      "pseudo db",
      "data/ pattern"
    ],
    "category": "infra",
    "short": "Hand-curated content files under vendor/get-anything-done/data/*.json, read at prebuild time and typed into the site.",
    "full": "Per gad-71, the project uses a JSON pseudo-database for hand-curated content that doesn't belong in .planning/ XML (agent process state) or evals/ TRACE.json (eval outputs). data/ holds open-questions.json, bugs.json, glossary.json, etc. — anything a human authors that the site should render. The prebuild script reads each file, validates shape, and emits typed TypeScript exports into lib/eval-data.generated.ts. No runtime services, no ACID, no servers — fine because the site has no customers, no PII, no secrets. Migration path to a real database is clear if we ever need one (we don't expect to).",
    "related_decisions": [
      "gad-71"
    ],
    "related_terms": []
  },
  {
    "id": "ralph-wiggum-loop",
    "term": "Ralph Wiggum loop",
    "aliases": [
      "ralph loop",
      "wiggum loop"
    ],
    "category": "process",
    "short": "The agent loop where everything the agent needs to remember lives in repo files, not in the agent's context window.",
    "full": "Named after the RepoPlanner predecessor to GAD and, informally, the Simpsons character who is 'special.' The idea: context windows are ephemeral, agents forget, but the repo is persistent. If the plan, the state, the decisions, the skill library all live in committed files, the agent can rebuild its working memory at any time via a single snapshot command. GAD inherits this architecture from RepoPlanner and GSD. The pattern solves the context-rot problem: decisions drift over long sessions because the agent forgets what it decided earlier — but if decisions live in DECISIONS.xml, they're always queryable.",
    "related_decisions": [
      "gad-17",
      "gad-19"
    ],
    "related_terms": [
      "planning-loop"
    ]
  },
  {
    "id": "planning-loop",
    "term": "GAD planning loop",
    "aliases": [
      "gad loop",
      "plan execute verify commit"
    ],
    "category": "process",
    "short": "snapshot → pick one task → implement → update planning docs → commit. The durable iteration cycle GAD enforces.",
    "full": "Per gad-18, the GAD loop is: (1) `gad snapshot` to re-hydrate context, (2) pick one task (status=planned) from the snapshot, (3) implement it, (4) update TASK-REGISTRY.xml (mark done), STATE.xml (next-action), DECISIONS.xml (if new decisions), (5) commit. The loop is designed to survive auto-compaction: after the agent's context is compacted mid-session, running snapshot re-loads everything it needs to continue. Subagents working on GAD-tracked projects run snapshot at the start of their work too, with the project ID passed in the agent prompt.",
    "related_decisions": [
      "gad-17",
      "gad-18",
      "gad-24"
    ],
    "related_terms": [
      "ralph-wiggum-loop",
      "gad-workflow"
    ]
  }
];

export const GLOSSARY_UPDATED: string | null = "2026-04-09";

export interface DecisionRecord {
  id: string;
  title: string;
  summary: string;
  impact: string;
}

/**
 * Every decision in .planning/DECISIONS.xml parsed in full. Source of truth
 * for the /decisions page and for <Ref id="gad-XX" /> cross-linking.
 */
export const ALL_DECISIONS: DecisionRecord[] = [
  {
    "id": "gad-77",
    "title": "Contribution flow is human-first — snapshot is agent-facing, not human-facing",
    "summary": "Important clarification the user surfaced during the IA planning conversation: `gad snapshot` is a command for AGENTS to rehydrate context after compaction — it produces no useful output for a human reading it. A human contribution flow must NOT include running snapshot as a step. The correct human flow is: (1) clone the repo, (2) npm install (or pnpm/yarn), (3) open the repo in Claude Code (or Cursor/Codex/other agent runtime), (4) the GAD skills are already installed in the repo so the agent has them available, (5) the human talks conversationally to the agent about running an eval or introducing a new hypothesis. The human never reads STATE.xml; they read the site's /findings, /decisions, /questions pages. The agent reads STATE.xml on their behalf when they ask it to. **Contribution pages must explicitly separate the human path from the agent path** so users don't follow agent-facing instructions and get confused by the output. Decision also commits us to TESTING the contribution flow on a fresh clone in a new repo before publishing the /contribute page, to verify skills are actually present and usable without manual setup steps we've forgotten to document.",
    "impact": "(1) /contribute page ships with two clearly separated sections: \"Human workflow\" and \"What the agent does behind the scenes\". (2) The human workflow is bare bones: clone → install → open in Claude → talk. No snapshot, no XML editing, no planning loop explanation. (3) The agent workflow section is a short explainer so humans know the difference but aren't expected to follow it. (4) Before shipping /contribute, we run a fresh-clone test in a new repo to verify: (a) skills copy into .claude/, (b) the agent can snapshot on first run, (c) a conversational request like \"run the escape-the-dungeon-bare eval\" actually works. (5) No PR template, no eval submission rubric, no contribution guidelines doc yet — those are process overhead we don't need until we have contributors. (6) CONTRIBUTING.md in the repo root is queued as a follow-up after the fresh-clone test succeeds."
  },
  {
    "id": "gad-76",
    "title": "Target users + value-prop framing — researchers primary, indie devs experiential, pressure as the hook",
    "summary": "Formal statement of who the site is for and what it says. **Primary user: coding-agent researchers** (target A) — people evaluating skill frameworks, hypothesis quality, and measurement rigor. They read findings, click through to DECISIONS.xml on GitHub, scrutinize the rubric construction. They tolerate dense content and reject marketing copy. **Secondary user: indie devs curious about skill evolution** (target C) — they land via playable demos, stay for the research transparency, need jargon wrapped in tooltips. **Not the audience (yet):** enterprise teams evaluating for procurement, framework authors looking to fork GAD wholesale. **Value proposition working line:** *\"A system for evaluating and evolving agents through real tasks, measurable pressure, and iteration.\"* This combines three load-bearing ideas: evaluating agents on real tasks (not benchmarks), measurable pressure (gad-75), and iteration (compound-skills hypothesis). **Explicitly NOT the value prop:** \"Use GAD to ship software faster.\" The freedom hypothesis (gad-36) shows bare agents outperform framework agents on greenfield creative implementation — GAD's value is the measurement layer and task-management substrate, not shipping speed.",
    "impact": "(1) Landing page rewrite lands this session: hero headline uses the pressure framing, primary CTA is Play (B), above-the-fold priority stack is Play → Methodology → Findings → Hypothesis → Fork. (2) Copy across all pages must assume primary user A (no oversimplifying, no marketing), but must wrap jargon in Term tooltips for secondary user C. (3) Everything we build must serve user A or user C — if it serves neither, it's out of scope for now. (4) The open question gad-value-prop-landing-page-framing is RESOLVED by this decision + the landing rewrite that ships alongside it. (5) ASSUMPTIONS.md captures full details of both users + what we're NOT building for them."
  },
  {
    "id": "gad-75",
    "title": "Pressure is a first-class eval dimension — the measurable axis connecting game-feel, requirements, and skill evolution",
    "summary": "Introduced during the IA planning conversation on 2026-04-09: \"Pressure\" becomes a first-class evaluation dimension alongside quality, iteration count, and composite score. Working definition: pressure = the constraint intensity applied to the agent during an eval, composed of five sub-dimensions — (1) requirement complexity (moving parts, cross-system interactions, logic depth), (2) ambiguity (clarity, missing info, interpretation required), (3) constraint density (hard rules, architecture constraints, stack lock-in), (4) iteration budget (tool-use ceiling, retry passes, rate/529 limits), (5) failure cost (gate vs scored, visible vs hidden, cascading vs isolated). Pressure is what the requirements have been implicitly encoding, what the game design has been trying to deliver to players, and what the eval framework has been partially measuring without naming. Requirement versions implicitly ARE pressure tiers — v1 was low pressure, v5 is high pressure, and rounds ARE pressure transitions. Promoting pressure to a named variable lets us normalize cross-round comparisons and ask \"how did agent X perform under pressure tier Y\" instead of just \"what score did X get\". This is distinct from the rubric (which measures result quality) — pressure is metadata about the test conditions. Pressure ALSO connects the game-feel thread (players feel pressure as challenge, ingenuity is pressure on the player) to the eval-rigor thread, which is the project's strongest differentiator. The landing page value-prop reframes around \"evaluating and evolving agents through real tasks, measurable pressure, and iteration\" (gad-76).",
    "impact": "(1) Pressure score formula is a new research task — open question opened in data/open-questions.json. (2) REQUIREMENTS.xml templates gain an optional `<pressure-profile>` block per version capturing the five sub-dimensions as author-rated scores; this is self-rated metadata initially, refined later with programmatic extraction. (3) Per-run page gains a pressure tier badge next to the composite score. (4) /roadmap timeline renders pressure progression across rounds as a new axis. (5) A future /pressure page (queued, not yet built) will let users see agent-performance-vs-pressure as a scatter. (6) Findings writeups must name the pressure tier they're evaluating under. (7) This decision is the biggest single-session conceptual shift the project has made; it reframes the landing page entirely and becomes a major signal of research credibility versus \"just another agent framework\" positioning."
  },
  {
    "id": "gad-74",
    "title": "GAD's actual value proposition — task management at scale in-repo + skill evaluation, NOT \"ship software faster\"",
    "summary": "User articulation: \"the main value I am seeing with GAD is not software implementation fully as products. but definitely a good task management at scale all while in repo. get-anything-done's repo and the site/data is all in repo and we encourage others to clone and contribute any experiments and builds they want.\" Formal statement of GAD's value proposition, anchored by months of eval data: (1) **Durable task management at scale with everything in-repo.** `.planning/` XML + `data/` JSON + `evals/` artifacts + `site/` generated TS — no external database, no external service, no SaaS lock-in. Fork the repo, run `gad snapshot`, contribute. (2) **Scientific framework for proving skill effectiveness and workflow discipline.** The eval framework is the load-bearing feature: it tests whether skills, frameworks, and workflows actually produce better work using structured experiments (rounds, rubrics, gates, derived metrics). (3) **Skill security posture** (longer-term ambition per gad-73) — trust model, provenance, evaluation of effectiveness. Explicitly NOT GAD's primary value: \"use GAD to ship your production software faster.\" The freedom hypothesis (gad-36) already showed bare agents can outperform on creative implementation. GAD may produce disciplined garbage for greenfield game dev while being excellent for task-heavy coordination, planning, and evaluation work. The site's framing must reflect this honestly.",
    "impact": "Landing page rewrite (queued): hero copy stops implying \"use GAD to build things\" and leads with \"understand whether agents are actually building things well, and keep everything in the repo.\" Open question gad-value-prop-landing-page-framing captures the specific rewrite pass. /methodology page must reference this decision so first-time visitors understand the research framing. Future eval categories (brownfield, content-pack injection per gad-66, codex-vs-claude comparison per task 89) all serve the value-prop of scientific skill/workflow evaluation, not of software shipping speed."
  },
  {
    "id": "gad-73",
    "title": "Fundamental skills triumvirate — create-skill / merge-skill / find-skills as GAD's foundational set",
    "summary": "User vision: GAD provides three fundamental skills that together enable the emergent-evolution hypothesis (gad-68) to work in practice. (1) **find-skills** — locate a trusted fundamental skill from the GAD ecosystem. Examples of fundamentals: scientific-method, debug, write-tests, profile-performance, investigate-failure. Inspired by https://skills.sh/vercel-labs/skills/find-skills but scoped to the GAD trusted pool initially (expanding later). (2) **merge-skill** — fuse a fundamental into a more project-attuned skill. Example: merge scientific-method into kaplay-rune-spellcrafting-debug, producing scientific-method-for-kaplay-rune-spellcrafting — a project-tailored skill with the fundamental's rigor baked in. (3) **create-skill** — author genuinely new skills when no merge candidate exists. This triumvirate is the META LAYER of the in-game rune/spell merging mechanic the evals are producing: the agent's skill library evolves via the same combine-fundamentals pattern the game teaches players. This is not coincidence — it's the most visible instance of the craftsman metaphor (gad-68) working at two levels simultaneously. Goal: build up a library of skills with fundamental expert practices tailored in, across many greenfield prototypes + brownfield applications. Security posture: the bigger vision is to \"provide security for skills, prove skills effectiveness and workflows with builds\" — a trust model where merging a fundamental into a tailored skill carries the fundamental's provenance forward.",
    "impact": "Audit task queued (task 103 follow-up): walk skills/ and identify which of the triumvirate already exist. create-skill likely exists. merge-skill and find-skills may not. Build whichever is missing. Mark the triumvirate as `category: foundational` in frontmatter so they're visually distinguished on the site's skills directory (task 85). The emergent eval template must bootstrap-inherit all three fundamentals so every emergent run has the tools to find+merge+create from day one. This also answers the CSH hygiene question from gad-65: a healthy emergent run should show evidence of find-skills lookups, merge-skill invocations authoring tailored variants, and create-skill usage only when merging failed. Tracked via hook events per GAPS G2 and G11."
  },
  {
    "id": "gad-72",
    "title": "Rounds framework — requirements-versioned, progressive complexity, hypothesis revisits allowed",
    "summary": "Formal statement of the rounds framework the project has been operating under informally. (1) A round is DEFINED by a requirements-document version. New requirements version = new round. This is the unit of \"what are we testing against.\" (2) Multiple eval versions can ship inside a single round — round 4 has etd v9, etd v10, bare v5, emergent v4 (4 builds across 3 projects) and all belong to round 4 because they all target requirements v4. Within-round versions exist because different agents and workflows produce different builds against the same requirements, and because we retry runs that were rate-limited or api-interrupted. (3) Rounds are progressively MORE complex — requirements expand monotonically from v1→v2→...→v5. Each round's requirements include or supersede the previous. No requirements are silently dropped; deferrals are explicit in the version history. (4) Earlier rounds CAN be re-evaluated with NEW hypotheses. Not every build in an earlier round can be trusted for every hypothesis — the measurement frameworks, metrics, and harnesses at round 2 were weaker than at round 4. But earlier rounds still produce data useful for hypotheses that weren't the primary test at the time. (5) A new hypothesis can START a new round against the current requirements version OR an earlier one. Example: \"does codex-cli build similarly to claude-code given the same v4 requirements?\" is a valid new round-against-v4 producing a new line of data without requiring a v6. (6) COMPLEXITY LADDER as a research tool: different requirements versions represent different complexity levels; a hypothesis might only be answerable at a specific level. A runtime comparison (claude vs codex) might work best at v3 where the requirements are simpler and the comparison is cleaner.",
    "impact": "Site must surface: (a) per-eval-project list of rounds the project has participated in with which requirements version was targeted, (b) per-round list of every eval version that ran, (c) per-run display of both the requirements version targeted AND a link to the previous round's requirements for context. REQUIREMENTS-VERSIONS.md is the authoritative ladder. New eval runs MUST pick a requirements_version that exists in REQUIREMENTS-VERSIONS.md; if a new version is needed the version must be added before the run. The `/roadmap` timeline page (task 88) renders this framework as the narrative of the project — what requirements version was tested when, what shipped, what got deferred. Earlier-round revisits (e.g. running codex against v3) are first-class and must not be labelled as \"outdated\" — they're new data points with different complexity."
  },
  {
    "id": "gad-71",
    "title": "data/ JSON pseudo-database for hand-curated site content",
    "summary": "User proposal: \"we might want to have a pseudo database that is json some json that gets stored in the repo and we use that to collect all the static data we need for the site and operate like it is a database, just in repo as dont expect customers and sensitive information at all.\" Formalize the pattern: `vendor/get-anything-done/data/*.json` files are the authoritative source of hand-curated content for the site. The prebuild script (`site/scripts/build-site-data.mjs`) reads them at build time and emits typed TypeScript via `site/lib/*.generated.ts`. The site never runs queries at request time — every page is SSG, every data file is read once at prebuild, types are statically exported. This is distinct from `.planning/` XML (which is agent-authored process state like phase/task/decision) and from `evals/<project>/<version>/TRACE.json` (which is eval-run output). `data/` is specifically for curated knowledge that doesn't belong in either of those two places: open questions for the public, observed bugs across eval runs, glossary terms, user-workflow assumptions, content packs extracted for gad-66, human-review tracking metadata, etc. Security posture is explicit: this is a static site with no customers, no authentication, no PII, no secrets. JSON-in-git is appropriate because we have no need for ACID, transactions, or concurrent writers — one human edits files in a branch, the prebuild regenerates, the site ships. If we ever need any of those properties (we don't expect to), the migration path is clear: JSON schemas become table definitions, the prebuild becomes a seed script.",
    "impact": "(1) Create `vendor/get-anything-done/data/` with an initial set of files: `open-questions.json`, `bugs.json`, `glossary.json`, `assumptions.json`. (2) Extend `build-site-data.mjs` with a new section that reads each data file, validates shape, and writes corresponding TS exports. (3) New site routes backed by these files: `/questions` (open-questions.json), eventually `/glossary`, `/assumptions`. (4) Every file gets a top-level `_schema` field documenting its shape + a `_last_updated` field maintained by hand. (5) When a new hand-curated data type is needed, the pattern is: add `data/&lt;name&gt;.json` → add a reader to `build-site-data.mjs` → add a typed export to `lib/&lt;name&gt;.generated.ts` → build a consuming page. No new runtime services, no servers, no API routes."
  },
  {
    "id": "gad-70",
    "title": "Anthropic skills guide is the canonical reference for skill quality",
    "summary": "The Anthropic \"Complete Guide to Building Skills for Claude\" (resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf) is adopted as the canonical reference for what a good skill looks like and how to test one. Three testing layers from the guide are named: (1) triggering tests — does the skill load on relevant / paraphrased / negative queries, (2) functional tests — valid outputs, API calls succeed, error handling works, edge cases covered, (3) performance comparison — proves the skill improves results vs. baseline using defined success criteria. Three skill categories from the guide are adopted as metadata on our authored skills: doc/asset creation, workflow automation, MCP enhancement. Iteration signals (undertriggering, overtriggering, execution issues) become named failure modes in our skill failure-mode taxonomy. Every skill we author or evolve must be auditable against this guide, and /methodology + /rubric + a new /skills-guide page must cite the PDF so users can follow our lineage to Anthropic's own guidance.",
    "impact": "(1) skills/create-skill.md body must reference the guide and add a \"category\" frontmatter field (doc-creation|workflow|mcp-enhancement). (2) A /skills-guide route on the site embeds the three testing layers with examples and links to the PDF. (3) Every /skills/[id] detail page shows which of the three categories the skill belongs to and whether it has triggering/functional/performance-comparison tests. (4) The emergent eval's skill_inheritance_effectiveness rubric dimension is extended to check whether newly-authored skills follow the guide's description/trigger format. (5) Continual review cadence: each round's findings writeup must answer \"did we drift from the Anthropic guide since the last round?\""
  },
  {
    "id": "gad-69",
    "title": "Programmatic evaluation is the priority — minimize agent-self-report dependency",
    "summary": "User directive: \"I don't want to be too dependent on the agents following guides/tasks to evaluate agents following guides/tasks.\" Evaluation framework must prioritize objective data produced by tooling, hooks, tracing, servers, parsing, and automation over agent self-reports, human judgment, or \"did the agent follow the rubric\" checks. Every new eval metric must answer \"can this be collected programmatically?\" before \"how do we score it?\" — and if programmatic collection is feasible, it takes priority. Human review stays for quality dimensions that genuinely need human judgment (is the UI enjoyable, does the game feel right) but everything mechanically checkable (did the skill actually load, did the gate pass, did the tool use mix look right, did the agent merge skills when it should have) must be captured automatically. This is the strongest framing of gad-61 to date.",
    "impact": "New ongoing research task: audit every current eval data field for \"programmatic vs human-reported\" and build a gaps list. Candidates to automate immediately: skill-triggering coverage (did the skill load on the right tool_use patterns), functional gate checks (playwright smoke tests for G1-G4), tool-use discipline signals (over/under-triggering relative to skill descriptions), sub-agent spawn counts, commit rhythm, plan-adherence delta, deviation count, build+test pass/fail. Deliverable: `.planning/GAPS.md` with each gap ranked by eval impact and which phase picks it up. Every new eval metric PR must include a line stating whether the metric is programmatic or human-reported."
  },
  {
    "id": "gad-68",
    "title": "Emergent-evolution working hypothesis — skill-evolution + emergent projects + tailored merging",
    "summary": "Synthesis of the freedom hypothesis (gad-36), compound-skills hypothesis (gad-65), and the consistent GAD-framework hiccups observed across rounds 1-4 into a single working hypothesis. Statement: \"A coding agent given blank planning artifacts, requirements, a task, and the ability to (a) create new skills, (b) merge similar skills, (c) find related skills to help, plus GAD-provided foundational skills to merge against, will produce better work than framework-constrained or bare conditions over time — because projects are themselves emergent, and skills must be tailored to the specific project continually and merged with similar foundational skills to maintain consistency.\" The craftsman/lifter metaphor: a master lifter varies exercise and lowers weight to stay sharp, the craftsman returns to fundamentals to maintain form — depending on the goal, the agent should tailor to the project while rehearsing fundamentals. This aligns with what the original Ralph Wiggum loop creator and the repomirror creators have written about as well. The GAD framework's role is NOT to prescribe process — it's to provide the foundational skill pool to merge against and an evolution substrate for project-tailored skills to form on top. This hypothesis is the research goal of the emergent eval condition; freedom hypothesis tests bare vs framework on a single round while this hypothesis tests whether GAD-with-evolution compounds over many rounds into project mastery. Distinct from vanilla compound-skills: this adds the merging + foundational-rehearsal dimensions and explicitly names GAD's role as a skill pool rather than a process prescription.",
    "impact": "Round 5+ emergent eval condition must include: (1) a foundational skill pool inherited from GAD that the agent can merge against, (2) a skill-merge tool the agent can invoke (e.g. `gad skill merge <a> <b>`), (3) a way to mark a skill as \"project-tailored\" vs \"foundational rehearsal\" in frontmatter, (4) the Nyquist audit for each round checks whether merging happened and whether project-tailored skills compound. Site must carry this framing on the landing page and /gad route as the first-class hypothesis, replacing or supplementing the freedom-hypothesis framing. Also: projects themselves are emergent — acknowledge that requirements evolve as we observe what the evolution produces (v5 addendum was born from playtest, not upfront design)."
  },
  {
    "id": "gad-67",
    "title": "Serial eval execution is the permanent default — parallel requires explicit authorization",
    "summary": "Reinforcement of gad-62 with a stronger default. User directive after round 4: \"our tests done sequentially to use the full token/budget that we get for these evals is more than likely what we will need to do rather than run them all in parallel most of the time. we will just need to remember to eval.\" Policy: any agent session proposing an eval run defaults to serial execution (one condition at a time, to completion, allowing the full per-session token budget to absorb any single run). Parallel execution is an explicit exception requiring (a) a stated reason why serial is insufficient, (b) a pre-computed token budget showing parallel runs will not collide on the shared account cap, and (c) explicit user authorization in the current session. Agents MUST NOT batch-launch parallel eval worktrees as a default. \"We will just need to remember to eval\" is also captured: agent sessions working on eval-relevant code must proactively surface \"run the eval to validate?\" after significant requirements or template changes.",
    "impact": "Update any documentation that implies parallel is the default (gad:eval-run skill, AGENTS.md for evals, portfolio site eval docs). `gad eval suite` docstring already clarifies this but should gain a top-of-output warning when invoked without the --parallel flag. Agents pick one eval at a time and run it to honest completion before queuing the next."
  },
  {
    "id": "gad-66",
    "title": "Authored-content injection experiment — inherit content packs alongside requirements",
    "summary": "New eval condition proposal: preserve every run's authored game content (spells, runes, items, NPCs, dialogue trees, skills, encounter tables) as a portable \"content pack\" separate from the source code. A subsequent eval run inherits both the requirements document AND a content pack extracted from prior runs, then builds on top. This is NOT a freedom-hypothesis test — it explicitly scaffolds the agent with pre-authored content and measures how much more fleshed out the resulting game becomes given the same requirements. User's framing: \"given some requirements and some already made content, it will build on top of that. this will just possibly make a more fleshed out game.\" Terminal research objective (user verbatim): \"have a really complex game made with all the builds and data around it for coding agent transparency and ability.\" The intent is to accumulate a growing canon of authored content across rounds so that eventually the escape-the-dungeon canon has enough depth that a single agent run can produce a genuinely complex game. Distinct from the emergent workflow which inherits *skills* (meta-methodology); this inherits *content* (domain data). The two can be combined: emergent+content run inherits skills AND a content pack.",
    "impact": "Requires a new extraction step in `gad eval preserve` that writes an authored-content manifest (content-pack.json + per-category json files) alongside the existing code + planning artifacts. Requires a new eval project flavor (e.g. escape-the-dungeon-inherited or a content_pack field on gad.json) that specifies which prior run's pack to inherit. Site gains a \"content lineage\" view per project showing which content objects originated in which run and which runs inherited them. Queued as a new phase task, not blocking round 5. Round 5 still runs on v5 requirements without content injection to keep the freedom/CSH tests clean."
  },
  {
    "id": "gad-65",
    "title": "Compound-Skills Hypothesis — emergent workflow as a skill-growth framework tailored to a specific project domain",
    "summary": "The emergent eval condition is not just \"inherit some skills and don't regress.\" It is a testable hypothesis about knowledge compounding: **as an emergent agent iterates on the same project domain across rounds, its inherited skill library should grow more specialized to that domain, and the game it produces should improve in quality and requirements-alignment per round more than bare produces by starting fresh.** The craftsman metaphor: a blacksmith who learns one skill per hour and authors one skill per hour becomes a master of the specific kind of blade they keep forging. The test signals: (1) human review score increases monotonically across emergent versions; (2) inherited skill count grows across rounds; (3) the ratio of project-specific skills to generic methodology skills trends toward specific; (4) time-to-working-game decreases across rounds despite the requirements getting stricter. Round 4 emergent v4 produced the first observed full inheritance → apply → evolve → document cycle (authored dom-over-kaplay + pressure-forge-coupling and deprecated kaplay-scene-pattern). The next emergent run (v5) is the first real test of whether v4's learnings actually help. DISTINCT from the freedom hypothesis (bare beats GAD on creative implementation) — CSH is specifically about whether the emergent mechanism produces compounding returns over time, independent of the bare vs GAD framing.",
    "impact": "Phase 27 rubric adds a sixth dimension for emergent runs: skill_inheritance_effectiveness (weight 0.20), which directly scores whether a run productively applied inherited skills, evolved them, and authored new skills worth inheriting. Site's /projects/escape-the-dungeon-emergent page gains a skill lineage view showing which skills each run inherited, evolved, deprecated, and authored. Findings writeups track CSH metrics separately from freedom-hypothesis metrics. Every emergent run's TRACE.json should capture inherited_skill_count, authored_skill_count, deprecated_skill_count, and (optionally) a specificity_score measuring how tailored the authored skills are to the roguelike domain vs generic workflow."
  },
  {
    "id": "gad-64",
    "title": "API-interrupted runs are a separate failure category from rate-limited runs",
    "summary": "Round 4's GAD v10 hit Anthropic API 529 overloaded_error twice. This is server-side transient load, not an account rate limit — different cause, different retry semantics, different interpretation. TRACE.json now distinguishes the two via separate flags: timing.rate_limited (account cap hit — gad-63 treats these as preserve-but-exclude) and timing.api_interrupted (server overload — ALSO preserve-but-exclude, with interruption_reason field capturing the specific HTTP error). Both flags filter runs out of cross-round quality comparisons in the site's Graphs and Results sections. The distinction matters because rate-limited runs imply budget planning issues while api-interrupted runs imply external infrastructure issues — researchers reading the /findings/ round writeups need to see which failure mode they're looking at.",
    "impact": "site isRateLimited() helper extends to isApiInterrupted() and comparableRuns() excludes both. Per-run pages get an amber \"API interrupted — server overload\" badge distinct from the \"rate limited — account cap\" badge. TRACE.json schema allows both flags on the same run (a run could theoretically hit both)."
  },
  {
    "id": "gad-63",
    "title": "Rate-limited runs are preserved as data points but excluded from cross-round quality comparisons",
    "summary": "TRACE.json files from rate-limited runs are still preserved (the partial work is informative about planning differential, architecture patterns, and inheritance effects) but explicitly excluded from freedom-hypothesis comparisons, Graphs scatter plots, and cross-round score aggregation. The filter key is `timing.rate_limited === true` in TRACE.json. Site rendering (Results, Graphs, /insights) should filter these out by default with an opt-in \"include rate-limited\" toggle for researchers. The human_review.notes field on every rate-limited TRACE carries \"DO NOT include in cross-round comparisons against completed runs\" as the explicit instruction.",
    "impact": "Site's Results cards, Graphs scatter plot, and per-round summaries default-filter rate_limited runs. The runs still show up on /runs/[project]/[version] pages with a \"rate limited\" badge and a link to the partial-results finding doc. Raw data is preserved forever; comparison treatment is explicit."
  },
  {
    "id": "gad-62",
    "title": "Parallel eval runs share a single account rate limit — serial execution is the default",
    "summary": "Round 4 attempt #1 launched GAD + Bare + Emergent in parallel via three worktree agents. All three hit an account-level rate limit simultaneously at ~14 minutes (tool_uses 81/45/40) with the message \"You've hit your limit · resets 12am America/Chicago\". The shared bucket meant none of the three runs finished. Implication: parallel eval runs on one account are a false economy. Serial execution (one agent to completion before launching the next) is the new default. Parallel is only acceptable when we have documented per-account capacity and a pre-calculated budget for the combined workload.",
    "impact": "Eval runner behaviour change: `gad eval suite` no longer implies parallel execution. Future round 4 retries run serially (one greenfield condition at a time), expected 20-30 min each, 60-90 min total wall clock. Parallel execution available as an explicit flag if/when per-run budget is known."
  },
  {
    "id": "gad-61",
    "title": "Research priority: structured objective data production for evaluations",
    "summary": "The primary goal of the eval framework is no longer \"score runs\" — it's \"produce structured data that yields insights.\" A score is just one kind of derived data; the framework should also produce structured human review rubrics (dimensions instead of single numbers), automated gate checks (playwright tests instead of human inspection for things automatable), derived metrics (tool mix, commit rhythm, plan-adherence deltas, divergence scores), cross-run aggregation queries, and visualizations that surface patterns rather than just summaries. Phase 27 is the research methodology phase that designs all of this in parallel with phase 25's raw event capture. Future decisions about what to measure next always answer \"does this yield an insight we can represent objectively?\" before \"how do we score it?\"",
    "impact": "Phase 27 opens in the roadmap as a peer of phase 25. skills/objective-eval-design/SKILL.md captures the methodology. Phase 25 is about getting the raw events; phase 27 is about what we do with them. The two phases can proceed in parallel — phase 27 designs against v3 trace data today and gets richer inputs when v4 lands."
  },
  {
    "id": "gad-60",
    "title": "Trace event output field capped at 4 KB with head/tail truncation",
    "summary": "Individual event `outputs` fields in the JSONL stream are capped at 4096 bytes. When raw output exceeds the cap, it's split into 2 KB of head + 2 KB of tail joined by a \"... [truncated N bytes] ...\" marker, and the event is stamped with `truncated: true`. Full untruncated output remains in Claude Code's session.jsonl which is accessible on disk for any run that needs deeper inspection. The 4 KB cap keeps noisy runs (hundreds of events over a 15-minute session) under 1-2 MB of trace data, comfortably within git's working-tree range.",
    "impact": "Phase 25 hook handler implements the truncation. The site's per-run page renders the head/tail split as a collapsible code block with a \"view full output in session.jsonl\" link. Future sub-phase can add full-output lookup if we find ourselves reaching for session.jsonl frequently."
  },
  {
    "id": "gad-59",
    "title": "Hook handler lives in the GAD repo, referenced by absolute path from user settings",
    "summary": "The hook handler script lives at vendor/get-anything-done/bin/gad-trace-hook.cjs (or equivalent in the distributed GAD package). `gad install hooks` writes an absolute path reference into the user's ~/.claude/settings.json pointing at the installed GAD binary. This gives us one canonical handler per framework commit, zero per-workspace drift, updates via `gad update`. `gad uninstall hooks` is the reverse operation. Handler receives arguments via stdin per Claude Code's hook contract and appends JSONL events to &lt;project-root&gt;/.planning/.trace-events.jsonl (append-only, gitignored).",
    "impact": "Phase 25 ships both `gad install hooks` and the handler script. Users run the install command once per workspace; subsequent framework updates pick up new handler behaviour automatically because the path reference points at the installed package. Alternative rejected: per-workspace handler written by install — drifts from framework version, harder to update, defeats the purpose of centralised versioning."
  },
  {
    "id": "gad-58",
    "title": "Skill invocation marker: hybrid file + hook-emitted event",
    "summary": "The agent writes a single plain-text file at .planning/.trace-active-skill containing just the active skill id. That's the entire agent-side burden — one file write per skill start. The hook handler reads this file on every PreToolUse event to attribute subsequent tool uses to the active skill (adds trigger_skill field on each event) and detects content changes to emit a discrete skill_invocation event whenever the active skill transitions. Gives us both low agent burden and structured/objective data: the hook is the source of truth for the skill_invocation event stream, not the agent's self-reporting. For nested skills (skill X applies skill Y), the currently-active skill is whichever one the file last pointed to, and the skill_invocation event records the parent as whatever was active before the transition.",
    "impact": "Phase 25 implements the hook logic that reads and watches .planning/.trace-active-skill. The skills/ documentation is updated to instruct agents to write the marker on skill start and clear it on skill completion — this is a low-burden contract that can be enforced via linting. Alternatives considered and rejected: (a) explicit bash command marker — more agent burden, duplicates events in the tool stream; (b) inference from tool use patterns — too lossy, not objective."
  },
  {
    "id": "gad-57",
    "title": "Remotion parameters: 30s max, cinematic passthrough, stoppable, /videos route + inline embeds",
    "summary": "Phase 26 parameters pinned: every composition is max 30 seconds, rendered as a cinematic passthrough (linear timeline, no branching), but the player must expose play/pause so viewers can stop mid-scroll. Videos live in two places: (1) inline \"watch this dissection\" embeds on relevant per-run pages — e.g. the v8 failure dissection shows up on /runs/escape-the-dungeon/v8, and (2) a dedicated /videos route that lists every composition with a search/filter so visitors can browse them standalone. All compositions reuse existing site React components (Graphs, ScoreBar, Cards, etc) as video frames — no separate asset pipeline. No MP4 compilation. @remotion/player handles all rendering client-side. Composition registry lives in site/remotion/Root.tsx.",
    "impact": "Phase 26 is now execute-ready. No more discussion needed on length, format, playback, or placement. Next sessions can author individual video compositions against this spec and register them in the registry. Remotion Player is free for teams ≤3; no paid license needed for the current shape of the project."
  },
  {
    "id": "gad-56",
    "title": "Lineage attribution: GSD → RepoPlanner → GAD",
    "summary": "GAD's lineage is acknowledged explicitly on the public site. Get Shit Done (gsd-build, https://github.com/gsd-build/get-shit-done) is the upstream inspiration — small planning loops, visible state, executable specs. RepoPlanner (b2gdevs, https://repo-planner.vercel.app/) was an earlier attempt by the same author to formalize the \"Ralph Wiggum loop\" (continuous agent work maintained by in-repo documents and tasks) — the core insight: keep docs and tasks in the repo so long development always has context and something to work on. GAD builds on both: the planning rigour of GSD, the in-repo context persistence of RepoPlanner, plus the eval framework as the thing that distinguishes us — we actually measure whether the loop helps. The /lineage page on the site tells this story with concrete links and explains the context rot problem each approach tries to solve.",
    "impact": "/lineage page exists and links to both upstream projects. Any talk of \"what GAD is\" has to route through this lineage — we're not claiming to have invented structured agent planning, we're claiming to have taken two previous approaches and added measurement. Keeps us honest and gives visitors a starting point if they'd rather use GSD or RepoPlanner."
  },
  {
    "id": "gad-55",
    "title": "Multi-agent tracing is a conversion problem, not a reimplementation problem",
    "summary": "If we ever want to evaluate Codex, Aider, or other hook-capable agents, the path is: their native session format → a converter script that emits GAD trace schema v4 → the same /runs/[project]/[version] page renders it. No per-agent site code. Codex's output format (Running/Ran prefixes with output blocks under ` └ `) is parseable but stream-based — would need a converter that tails the session and emits trace events. Captured here so we don't go down the \"let's add Codex-specific TRACE fields\" path when the right answer is a converter.",
    "impact": "Phase 25 ships the Claude Code converter first. Future phases can add codex-to-trace or aider-to-trace converters as needed. The trace schema itself stays agent-agnostic. Unit of comparison is \"a trace\", not \"a trace from Claude Code specifically.\""
  },
  {
    "id": "gad-54",
    "title": "Eval backfill policy: freeze old scores, stamp new runs with framework version",
    "summary": "When the framework changes (new skill, new subagent, rewritten command), old eval scores are never recomputed. They're historical records, frozen at the framework commit they ran against. New runs against the updated framework get stamped with the new framework commit and become the \"current\" data point for cross-version comparisons. This preserves the archaeology — a reader can see what a v5 escape-the-dungeon run scored in April 2026 against framework v1.32.0 and trust that number. Framework drift is detected by re-running the same eval against the current framework and diffing, not by rewriting history.",
    "impact": "skills/framework-upgrade/SKILL.md documents this as the invariant. The site's /methodology page explains it. Trace schema v4 adds a mandatory gad_version + framework_commit field so every run is self-describing about which framework it ran against. No backfill commands exist in the CLI; any attempt to rewrite an old TRACE.json is a bug."
  },
  {
    "id": "gad-53",
    "title": "Trace schema v4 requires hook-aware agents — other coding agents are explicitly unsupported for tracing",
    "summary": "Phase 25's trace schema v4 captures every tool_use, skill invocation with trigger context, and subagent spawn with inputs/outputs. The only reliable way to capture this data is from within the coding agent's runtime via hooks — Claude Code's PreToolUse/PostToolUse hooks, Aider's Python callbacks, Continue.dev's extension API. Agents without hook runtimes (Cursor's closed-source editor, basic Codex CLI, vanilla ChatGPT) cannot produce trace v4 data and are explicitly unsupported for GAD evaluation. This isn't a limitation we're going to work around — attempting to reconstruct tool calls from stdout parsing or screen-scraping is lossy and fragile. We'll publish an Agent Runtimes comparison on /methodology listing which coding agents are evaluable and which aren't, and why.",
    "impact": "Phase 25 eval harness wiring is Claude-Code-specific (via its hooks). Future support for other agents requires each one to expose a structured tool-use event stream. The site's /methodology page has an Agent Runtimes table explaining this; the agent runtime requirement becomes a gate criterion in the eval project gad.json so runs against unsupported agents are rejected at the eval-run step."
  },
  {
    "id": "gad-52",
    "title": "Remotion is how we ship video explainers — player, not compiler",
    "summary": "Remotion's @remotion/player is a React component that renders video compositions live in the browser without requiring MP4 export. Free for teams ≤3 and reuses existing React components (SiteHeader, score cards, SVG charts) as video frames. No separate asset pipeline — video IS composable React. Phase 26 scopes what videos we want (GAD loop walkthrough, v8 failure dissection with tracing overlay, freedom hypothesis explainer, bare-vs-emergent emergence comparison) and plans the Player integration before implementing. MP4 export only if we need social-media distribution later; primary mode is interactive browser playback.",
    "impact": "Phase 26 is a discuss-first phase. No Remotion code ships until we've scoped the video list and confirmed the React reuse pattern. Decision captured now so future sessions don't have to rederive \"why not Adobe After Effects\" — the answer is \"because our React components are already the scenes we want to show.\""
  },
  {
    "id": "gad-51",
    "title": "Framework is versioned on branches so evals can pin + re-run across versions",
    "summary": "main = current. Frozen snapshots live on version/v1.1, version/v1.2, etc. When we ship a framework change that could affect eval scores (new skill, changed command, different subagent wiring), we branch, tag, and update a FRAMEWORK_VERSION constant used by `gad version`. Every TRACE.json stamps the commit it ran against so we can distinguish \"the agent did better\" from \"the framework changed.\" Re-running past evals against the current framework becomes a scheduled activity, and score drift between framework versions becomes visible.",
    "impact": "Phase 25 builds the branching strategy, `gad version` command, and the stamping. skills/framework-upgrade/SKILL.md is the methodology agents follow when proposing a framework change. Without this, cross-round comparisons that span framework updates are dishonest — we're comparing two different systems."
  },
  {
    "id": "gad-50",
    "title": "Trace schema v4: every tool use, skill invocation, and subagent spawn must be captured",
    "summary": "Today's TRACE.json has a bare numeric skill_accuracy field for most runs (e.g. escape-the-dungeon v8 = 0.17 with no breakdown of which of the 6 expected triggers fired vs missed). This means we can't interpret scores across workflows. Trace schema v4 will capture: (1) every tool_use with timestamp + name + outcome; (2) every skill invocation with trigger context (user phrase, auto-detected, explicit slash command); (3) every subagent spawn with inputs + outputs + duration; (4) every file mutation with path + size delta. Schema versioned so older traces still parse; rendering on the site degrades gracefully for pre-v4 runs.",
    "impact": "Phase 25 is the backing work. Per-run pages on the site will show a \"tracing gap\" callout for runs whose TRACE.json is pre-v4 and surface the full breakdown for v4+. Framework versioning (also phase 25) is a prerequisite because we need to know which trace schema the run was recorded against."
  },
  {
    "id": "gad-49",
    "title": "Bare and Emergent bootstrap skill set is a pinned invariant: create-skill + find-sprites",
    "summary": "Any bare or emergent greenfield eval template MUST include skills/create-skill.md and skills/find-sprites.md in its template/skills/ directory before the eval runs. These two are the minimum bootstrap methodology an agent needs to author its own workflow (create-skill) and source coherent visual assets (find-sprites). Emergent projects may inherit ADDITIONAL skills from previous runs, but the two-skill floor is non-negotiable. Regressing the bootstrap set without a corresponding requirements update invalidates cross-round comparisons for bare/emergent.",
    "impact": "portfolio-sync skill enforces this during site sync; any regression becomes visible because the /projects/[id] page shows the bootstrap set per eval and the catalog inheritance map flags the mismatch. If we intentionally change the bootstrap set (e.g. add a third skill), we bump the requirements version and document the change in REQUIREMENTS-VERSIONS.md."
  },
  {
    "id": "gad-48",
    "title": "GAD framework diagnosis (freedom hypothesis) is deferred — need more eval data first",
    "summary": "The round 3 findings showing bare consistently beats GAD on creative implementation are enough to treat as a real pattern but not yet enough to commit to structural changes (GAD-lite, pivoting away from creative evals, etc.). Before making architectural decisions about GAD itself, we need: (1) round 4 greenfield with v4 (pressure-oriented) requirements to see if the pattern persists; (2) brownfield round 1 to test whether GAD's overhead pays off on codebase extension; (3) at least one more iteration of each condition to establish variance. Discussions about GAD-full vs GAD-lite vs GAD-seeded are ongoing but not action items yet.",
    "impact": "Do not split GAD into variants yet. Do not abandon game evals yet. Focus round 4 on v4 requirements (pressure-oriented) with the same three conditions. Re-examine the hypothesis after round 4 and brownfield round 1 data. Keep the diagnosis thread open in DECISIONS but don't force premature conclusions."
  },
  {
    "id": "gad-47",
    "title": "Portfolio must host all experiment documentation before further experimentation",
    "summary": "User wants to view all experiment docs on apps/portfolio: links to code, game builds, scores, process, workflows, graphs, explanations of what's being tested. The portfolio acts as the public showcase of the experiment. Before running any more eval rounds, the portfolio must contain: (1) hub page explaining the experiment, the conditions (GAD/bare/emergent), and the freedom hypothesis; (2) per-round pages with scores and links to preserved builds + run code; (3) per-eval-project pages showing version history; (4) visualizations/graphs of scores across rounds; (5) requirements version history; (6) findings docs. Everything must be viewable from either the get-anything-done repo OR the portfolio docs sink.",
    "impact": "New phase 22 dedicated to portfolio experiment documentation. Blocks round 4 experimentation until complete. Uses existing apps/portfolio/content/docs/get-anything-done/ structure with new evals/ subsection. Each eval project + run has its own MDX page with links to apps/portfolio/public/evals/&lt;project&gt;/&lt;version&gt;/ for playable builds."
  },
  {
    "id": "gad-46",
    "title": "Skills evolution flow: greenfield emergent → brownfield emergent → greenfield (installed back)",
    "summary": "The experimental model for emergent workflows: (1) greenfield emergent creates initial skills from scratch (only has create_skill skill); (2) brownfield emergent inherits those skills + creates new ones as it extends existing code; (3) when proven, those skills can be \"installed back\" into the next greenfield emergent run as its inheritance. This creates a feedback loop where AI-decided workflows evolve across rounds and environments. GAD represents what humans have decided is good; bare and emergent represent AI-first AI-decided workflows for achieving the desired human output. The comparison is human-defined methodology vs AI-emergent methodology.",
    "impact": "Skills from each emergent run are preserved in evals/&lt;project&gt;/v&lt;N&gt;/run/.planning/skills/. When planning the next round, skills can be copied into the next template as inherited starting state. Both greenfield and brownfield can feed skills back into each other over time."
  },
  {
    "id": "gad-45",
    "title": "Emergent AGENTS.md stops mandating specific artifacts — agents define their own",
    "summary": "Round 3 emergent AGENTS.md prescribed ARCHITECTURE.md, CHANGELOG.md, specific directory layouts. That defeats the point of the emergent experiment, which is to observe what workflow artifacts an AI-decided workflow produces. v4 emergent AGENTS.md only mandates: (1) put all workflow artifacts in game/.planning/, (2) reference the create_skill skill to define new skills when patterns emerge. Everything else — what files exist, what formats, how tasks are tracked — is decided by the agent itself. Same applies to bare eval.",
    "impact": "emergent/template/AGENTS.md rewritten to be minimal. Bare template similar. Both reference a new create_skill skill that documents how to create reusable skills. This is the only skill bare starts with; emergent starts with create_skill + inherited skills from previous runs."
  },
  {
    "id": "gad-44",
    "title": "\"Traits\" in UI, narrativeStats in code — split terminology",
    "summary": "Player-facing UI shows narrative/progression stats as \"Traits\". Internal code/data can continue using narrativeStats as the technical term. Both must be documented with a mapping. Prevents churn of a full taxonomy rename while giving players the more legible label.",
    "impact": "UI label: Traits. Code identifier: narrativeStats. Docs note the mapping once. Applies to all eval templates and game builds from v4 forward."
  },
  {
    "id": "gad-43",
    "title": "Sprite sourcing is a workflow requirement with coherent fallback allowed",
    "summary": "v4 requires agents to attempt asset sourcing first through a defined search workflow: lightweight installable icon packs, web-searched free/open-license sprites, or common art sources. Fallback to generated/programmatic placeholders is allowed only if sourcing genuinely fails or integration cost becomes disproportionate — but the fallback must still be visually coherent. Ugly primitive-only presentation counts against the UI quality gate regardless of sourcing attempts. Requires creating a gad:find-sprites skill (or equivalent workflow doc) that agents can reference.",
    "impact": "Add a sprite-sourcing workflow skill agents can reference. UI gate stays strict — sourcing failure is not an excuse to ship ugly output. Authored asset sources (Pokemon-style open sprites, game-icons.github.io, etc.) preferred over procedural."
  },
  {
    "id": "gad-42",
    "title": "Skills (physical actions) are a scored criterion, not a gate, in v4",
    "summary": "Skills system (physical non-spell actions that evolve via own XP, can be supercharged with mana crystals) was considered for gate status but deferred. Forge is already a major gate and requiring both would cause broad-but-shallow implementations. v4 requires only that combat supports at least one non-spell action category (basic attack or skill). Full skill system with evolution and mana-crystal overcharge is scored, not required.",
    "impact": "v4 gate: combat has at least one non-spell action category. v4 scored: distinct skill system, mana overcharge, DoT/stun/bleed effects. Prevents the forge gate from eating all implementation budget."
  },
  {
    "id": "gad-41",
    "title": "v4 game requirements reframed: pressure over features",
    "summary": "Round 3 findings exposed that v3 was a features checklist, not a game design. Players could beat floors with default spells, forge was optional, no encounter tested adaptation. v4 flips this: every mechanic must create pressure that rewards ingenuity. Core principle: \"baseline starter abilities must not be sufficient to comfortably complete a full floor without adaptation or enhancement.\" Specific additions: floors contain 5-8 authored rooms + boss gate; each floor must introduce a mechanical constraint that default spells can't brute-force (elemental resistance, DoT requirement, reflection, etc.); forge gate requires at least one per-floor encounter that significantly favors crafted/adapted spells; pressure mechanics required from at least 2 of 4 categories (resource, enemy counterplay, encounter design, build specialization); new ingenuity/adaptation scoring dimension measures whether players needed to craft/adapt.",
    "impact": "v4 REQUIREMENTS.xml rewritten with gates reframed around friction, not feature checklists. Authored-only (no procedural generation). Room types: Combat, Elite, Forge, Rest, Event. Decay and deep evolution trees deferred to v5. Starter spells explicitly insufficient. New scored dimension: ingenuity_score = f(crafted_spells_used, spell_diversity, adaptation_required_by_encounters)."
  },
  {
    "id": "gad-40",
    "title": "Eval projects categorized by mode (greenfield/brownfield) and workflow (gad/bare/emergent)",
    "summary": "Evals are now categorized on two axes: eval_mode (greenfield starts from scratch, brownfield extends an existing baseline codebase) and workflow (gad uses full framework, bare creates own workflow, emergent inherits and evolves). Stored in gad.json. Shown in gad eval list. Brownfield evals reference a baseline (project+version) whose run/ becomes the starting codebase. Added three new brownfield evals: etd-brownfield-gad, etd-brownfield-bare, etd-brownfield-emergent — all starting from escape-the-dungeon-bare v3 as baseline, extended with v4 feature requirements (floor progression, respawning encounters, rune forge with affinity, skills system, visual upgrade).",
    "impact": "Brownfield experiments test how each workflow handles long-term project evolution vs fresh starts. The freedom hypothesis (gad-36) was measured on greenfield only — brownfield may produce different results because GAD's overhead could pay off more when extending existing code (planning docs help track what's already there). gad worktree commands added for managing the many worktrees these experiments create. AGENTS.md for bare/emergent simplified — less prescriptive, lets agents figure out workflow details themselves."
  },
  {
    "id": "gad-39",
    "title": "All eval workflow artifacts must live under game/.planning/ regardless of framework",
    "summary": "GAD, bare, and emergent evals all must place workflow/tracking/skills/decisions/notes files under game/.planning/. Source code in src/, assets in public/, process artifacts in .planning/. This separation allows clean inspection of what methodology each eval invented without mixing it into source. The format inside .planning/ is up to the agent (XML, Markdown, whatever). Violations (files at project root or mixed into src/) are detected by gad eval preserve and logged as warnings.",
    "impact": "AGENTS.md updated for all 3 eval templates with mandatory layout section. gad eval preserve detects and warns on violations. DEFINITIONS.md documents the contract. Round 3 findings: GAD runs compliant (had .planning/), bare and emergent all violated by putting WORKFLOW.md and skills/ at project root. Round 4+ will enforce."
  },
  {
    "id": "gad-38",
    "title": "Eval preservation is a hard contract enforced by tests",
    "summary": "Every implementation eval run MUST end with these artifacts preserved at canonical locations: (1) evals/PROJECT/vN/TRACE.json, (2) evals/PROJECT/vN/run/ with code+planning, (3) apps/portfolio/public/evals/PROJECT/vN/ with the playable build, (4) evals/PROJECT/vN/.gad-log/ with CLI logs. The gad eval preserve command copies everything after a run; gad eval verify audits compliance; tests/eval-preservation.test.cjs fails the build if any run on or after the contract cutoff is missing artifacts. Before this decision, multiple runs' outputs were lost when worktrees were cleaned up or builds were overwritten.",
    "impact": "Future eval runs cannot be \"forgotten\" — the tests enforce preservation. Every agent running an eval must call gad eval preserve immediately after agent completion, before the worktree is removed. gad:eval-run and gad:eval-bootstrap skills updated with mandatory preservation step. DEFINITIONS.md documents the contract at the top."
  },
  {
    "id": "gad-37",
    "title": "Eval game builds must be preserved per-version, never overwritten",
    "summary": "Previously, gad eval open copied builds to apps/portfolio/public/evals/PROJECT/index.html, overwriting previous runs. This destroyed experimental history. Now all builds are preserved at apps/portfolio/public/evals/PROJECT/VERSION/index.html. The gad eval open command checks version-specific paths first.",
    "impact": "All 8 escape-the-dungeon builds now preserved (v5-v8, bare v1-v3, emergent v1-v2). Experiments can be compared across time. Showcase path is apps/portfolio/public/evals/PROJECT/VERSION/ for every run."
  },
  {
    "id": "gad-36",
    "title": "Freedom hypothesis: GAD constraint may correlate inversely with creative output quality",
    "summary": "Across 3 rounds of escape-the-dungeon evals, Bare (no framework) consistently outperformed GAD (full framework) on human review. Round 3: Bare v3 = 0.70, Emergent v2 = 0.50, GAD v8 = 0.20. GAD has never exceeded 0.30 across 4 attempts; Bare is monotonically improving (0.10 → 0.50 → 0.70). GAD's planning overhead may consume tokens that could go to implementation and testing. The process is followed but the product fails. Status: PRELIMINARY — single-run variance is high, needs more data. Confound: rate limits may have hit GAD harder because it was mid-planning.",
    "impact": "(1) Do not abandon GAD — this may be specific to greenfield game implementation. (2) Create a GAD-lite mode for comparison. (3) Add context-resumption eval where GAD should show its advantages. (4) Re-examine GAD's value proposition: is it optimizing for traceability/handoff rather than creative speed? (5) The game eval may be the wrong benchmark for GAD's core strengths."
  },
  {
    "id": "gad-35",
    "title": "Bare eval condition is a live contender, not a deprecated baseline",
    "summary": "Bare v2 scored 0.50 human review (most playable game) versus GAD v7 at 0.30. The bare condition responds well when informed by prior failure signals, making it a valid forward-looking experimental condition. All three conditions (GAD, Bare, Emergent) remain in active testing with equal priority.",
    "impact": "Do not deprioritize or drop the bare condition. Continue iterating on all three. The bare condition's strength is adaptation from failure feedback — test that hypothesis further."
  },
  {
    "id": "gad-34",
    "title": "Human review weight raised to 0.30 with low-score caps",
    "summary": "human_review weight increased from 0.15 to 0.30 in composite formula. Added hard caps: if human_review &lt; 0.20, composite capped at 0.40; if &lt; 0.10, capped at 0.25. This prevents technically compliant but broken/unusable output from ranking highly. Process metrics cannot override a bad user experience.",
    "impact": "Composite formula updated in DEFINITIONS.md and gad.cjs. All existing auto_composite scores are now provisional — human review is required for the real score."
  },
  {
    "id": "gad-33",
    "title": "Spell crafting is a gate criterion — loot/rewards do not satisfy it",
    "summary": "The player must intentionally combine runes/components through a forge/crafting interface and produce at least one new spell outcome. Pre-equipped spells or spell rewards from NPCs/loot do not count. Minimum: 3-5 runes, 3+ valid combinations, crafted spell usable in encounters.",
    "impact": "Gate G2 added to REQUIREMENTS.xml v3. No previous run has satisfied this — all runs will need to implement a forge system for the first time."
  },
  {
    "id": "gad-32",
    "title": "UI quality is a gate criterion at full presentation level",
    "summary": "The build must include icons, visually differentiated room presentation, styled controls/panels, and entity visual representation. Easily installable icon/sprite packs, web-searched assets, or generated placeholders are acceptable when setup cost is low. Raw ASCII/text-only UI fails the gate. Geometric fallback tiles are last resort, not primary path.",
    "impact": "All game eval REQUIREMENTS.xml updated to v3 with gate G3 (ui-quality). Agents must source visual assets as part of implementation. Asset sourcing can be a skill."
  },
  {
    "id": "gad-31",
    "title": "Inherited skills must capture failure modes and fixes, not just patterns",
    "summary": "Emergent v1 inherited 4 skills from bare v1 but still failed (KAPLAY styled text error). The skills documented code patterns but not failure modes. Bare v2 (told about v1 failure, no inherited skills) succeeded because it had to solve the problem itself. Skills that only document \"how I did it\" without \"what went wrong and how I fixed it\" are insufficient for cross-run learning.",
    "impact": "Skill format should include: pattern, when-to-use, failure-modes, and known-fixes sections. Previous-workflow.md should include specific error messages and resolutions, not just \"it didn't work.\""
  },
  {
    "id": "gad-30",
    "title": "Eval requirements must be versioned and findings documented per experiment",
    "summary": "Requirements changed twice in one session (original 12 criteria → gate criteria + vertical slice). Each change invalidates comparison with previous runs. Requirements must carry a version tag, and FINDINGS docs must reference which requirement version was used. Scientific rigor requires reproducibility.",
    "impact": "Add version field to REQUIREMENTS.xml. FINDINGS docs reference requirement version. TRACE.json includes requirements_version field."
  },
  {
    "id": "gad-29",
    "title": "Process metrics do not guarantee output quality — human review is the ground truth",
    "summary": "GAD v7 scored 0.81 discipline and 1.0 planning quality but only 0.30 human review (broken game loop). Bare v2 scored 0.0 discipline but 0.50 human review (most playable game). Auto-composite can be misleading — the 15% human_review weight is insufficient. For implementation evals that produce user-facing output, human review should be weighted higher or serve as a gate.",
    "impact": "Re-evaluate composite weights for game evals. Consider human_review as a multiplier rather than an additive dimension. A game that scores 0.0 human review should never have a composite above 0.50 regardless of process metrics."
  },
  {
    "id": "gad-28",
    "title": "Granular eval metrics: versioned schema, summary in TRACE, detail in optional metrics.json",
    "summary": "Automation must not depend on regex-parsing human-oriented `SCORE.md`. Implementation evals gain `scores.json` (or equivalent) alongside `SCORE.md` with stable numeric fields. Tooling evals store a summary composite (`tooling_composite` or nested `scores`) in `TRACE.json` for gates and trends; high-cardinality data (per-invocation latencies, histogram buckets, full event traces) go in `metrics.json` or retained JSONL only when needed. Bump `trace_schema_version` when the summary shape changes. `gad eval report` / `diff` read structured JSON, not markdown, for machine comparisons.",
    "impact": "score-generator and eval scores command updated to emit and read JSON. Report tables can aggregate tooling and implementation evals. Raw logs remain optional debug artifacts."
  },
  {
    "id": "gad-27",
    "title": "Tooling and MCP evals are automated, fixture-based, and comparable across versions",
    "summary": "Evaluating watch/dev and MCP differs from implementation evals (agents building projects). Tooling evals use `eval_type` of `tooling` or `mcp`, a fixed `scenario` id pointing at an in-repo fixture, and an automated harness (Node script or `gad eval tooling run`) that starts the watcher or MCP client, performs scripted actions, and asserts ground truth (missing paths, exit codes) plus latency metrics. No LLM in the loop. Each run writes `TRACE.json` with `trace_schema_version` so new granular fields (p50/p95, event counts, feature_flags) can be added without invalidating old runs. Compare runs with the same scenario id to measure improvement per feature or gad version.",
    "impact": "New eval projects under `evals/` for tooling/mcp. CI can run them on every PR touching gad.cjs or verify libs. Feature flags or gad version are recorded in the trace for attribution."
  },
  {
    "id": "gad-26",
    "title": "Real-time GAD tooling: core first, transports second",
    "summary": "The live developer loop (watch planning files, re-run refs verify, surface results quickly) is implemented once as a small core: debounced filesystem watch, call into existing verify code paths, emit structured events (JSON lines or NDJSON) for consumers. CLI (`gad dev` / `gad watch planning`) is the first transport. An MCP server, if added, is a thin adapter over the same core — not a separate implementation. Primary user is humans and local tooling (terminal, scripts, CI); agent use via MCP is optional and must not block shipping the core. IDE/editor-specific integrations (VS Code tasks, problem matchers, extensions) are out of scope until explicitly re-scoped — not required for the core.",
    "impact": "New watch/MCP code should live next to existing `gad refs` / verify libraries. No required network service for v1. MCP must not duplicate business logic."
  },
  {
    "id": "gad-25",
    "title": "All GAD CLI calls and agent tool uses are logged to JSONL for eval tracing",
    "summary": "Every gad CLI invocation logs to .planning/.gad-log/ (JSONL, one file per day): timestamp, command, args, duration, exit code. A PostToolUse hook (tool-trace.js) logs every agent tool call (Bash, Read, Write, Edit, Agent, Skill, Grep, Glob) to the same directory. During eval runs, GAD_LOG_DIR routes logs to the eval run directory for permanent storage. `gad log show` displays both log types interleaved with filters (--filter cli|tool|gad|skill|agent). `gad eval trace from-log` builds TRACE.json from actual logs (source: call-log) instead of git reconstruction. This is the definitive, numerical, measurable observability layer.",
    "impact": "Evals produce real call logs, not reconstructed approximations. Agents that spawn subagents, trigger skills, or call gad CLI commands are all traced. Log data enables: per-tool-call token estimates, skill trigger verification, gad CLI usage patterns, and cross-eval comparison on actual behavior."
  },
  {
    "id": "gad-24",
    "title": "All skills and agents must bootstrap via gad snapshot, not manual file reads",
    "summary": "Skills were hardcoding \"read STATE.md, ROADMAP.md, DECISIONS.md, REQUIREMENTS.md\" as Step 1 — 4+ file reads that the gad snapshot command already provides in one low-token output. Skills must use `gad snapshot --projectid &lt;id&gt;` as their bootstrap step. Individual CLI commands (gad tasks, gad decisions, gad phases) are available for drilling into detail. Skills must also be format-agnostic (XML or MD) per gad-06 — never hardcode .md or .xml extensions when referencing planning files. CLAUDE.md enforces this at the instance level: every fresh session runs gad snapshot first.",
    "impact": "All core skills updated: execute-phase, plan-phase, check-todos, quick. CLAUDE.md created as hard startup requirement. Subagent prompts should include the project ID so agents can run gad snapshot. Deprecated GSD compatibility notices removed from all skills (gad-19 already killed GSD)."
  },
  {
    "id": "gad-23",
    "title": "Greenfield eval projects must auto-scaffold CONVENTIONS.md after phase 01",
    "summary": "The escape-the-dungeon agent created 13 source files with patterns (scene structure, content pack format, state management) but documented none of them. A follow-up agent would start cold with no conventions. After the first implementation phase, GAD should prompt or auto-generate a CONVENTIONS.md from the code patterns established — file structure, naming, import patterns, content pack format, scene registration pattern.",
    "impact": "Add a post-phase-01 checkpoint to eval-run and execute-phase that generates CONVENTIONS.md from the codebase. The gad:map-codebase skill already does this — it should be triggered automatically after the first implementation phase of any greenfield project."
  },
  {
    "id": "gad-22",
    "title": "Trace logging must be automatic — hooks or checkpoint-based, not manual log-cmd calls",
    "summary": "Manual trace logging (gad eval trace log-cmd/log-skill) requires the agent to remember to call them. The v2 eval proved this doesn't happen — the agent backfilled all 8 skill triggers in 15 seconds at the end. Tracing should be: (1) automatic via hooks that detect gad CLI calls and skill invocations, or (2) checkpoint-based where the agent must produce a trace entry to unlock the next phase, or (3) post-hoc by parsing git history and planning doc diffs to reconstruct what happened. Option 3 is the most reliable since it doesn't depend on agent cooperation.",
    "impact": "The eval-run workflow should reconstruct traces from git log + planning doc state changes, not rely on the agent to self-report. gad eval trace reconstruct --project &lt;name&gt; should parse git history to build TRACE.json after the fact."
  },
  {
    "id": "gad-21",
    "title": "Eval agents must be bootstrapped with GAD context — not just prompted",
    "summary": "The escape-the-dungeon eval (v2) showed that prompting an agent to \"use gad snapshot\" and \"log traces\" doesn't work — the agent ignored the CLI entirely, read requirements, and coded directly. Eval agents need: (1) GAD CLI available and working in the worktree, (2) AGENTS.md in the eval template that enforces the loop, (3) snapshot output injected into the agent's initial prompt (not \"run this command\"), (4) hooks or structured checkpoints that enforce task-level tracking. The agent must be inside the loop from the start, not asked to enter it.",
    "impact": "Eval templates must include an AGENTS.md with the GAD loop. The eval-run skill must inject snapshot context into the agent prompt. The agent's working environment must have gad CLI accessible. Honor-system tracing is insufficient — tracing must be automated or enforced via checkpoints."
  },
  {
    "id": "gad-20",
    "title": "Snapshot includes project-scoped conventions with global fallback",
    "summary": "gad snapshot includes a CONVENTIONS section: first checks project-level CONVENTIONS.md in .planning/, then extracts conventions/style sections from the project's AGENTS.md, then falls back to global root AGENTS.md conventions. Conventions grow per-project as code/content/patterns evolve — refactoring introduces new conventions, and the snapshot surfaces them to agents. Eval runs are expected to produce findings that tighten workflows, create new skills, and refine snapshot content.",
    "impact": "Every project can have its own CONVENTIONS.md. The snapshot surfaces the right conventions for the project being worked on. After eval runs, review outputs and create/update conventions based on what worked and what didn't."
  },
  {
    "id": "gad-19",
    "title": "GSD is dead — GAD and RepoPlanner only",
    "summary": "All GSD (get-shit-done) skills, hooks, commands, and references are removed from the repo. GAD is the planning framework. RepoPlanner provides the planning snapshot format that GAD consumes. No GSD commands in .claude/commands/, no GSD hooks in .claude/hooks/, no GSD references in settings.json or AGENTS.md. The context monitor and statusline hooks are useful infrastructure but must be rebranded for GAD — no npm checks for get-shit-done-cc.",
    "impact": "Delete .claude/commands/gsd/ entirely. Remove or rebrand .claude/hooks/gsd-* files. Clean settings.json. Remove GSD references from root AGENTS.md. Keep context monitor and statusline functionality but strip GSD branding."
  },
  {
    "id": "gad-18",
    "title": "The GAD loop is simple: snapshot → work → update docs → commit",
    "summary": "The canonical GAD loop for any agent, any coding tool:\n1. `gad snapshot --projectid &lt;id&gt;` — one command, full context. No reading 15 files manually.\n2. Pick one task from TASK-REGISTRY.xml (status=planned).\n3. Implement it.\n4. Update TASK-REGISTRY.xml (mark done), STATE.xml (next-action), DECISIONS.xml (if new decisions).\n5. Commit.\n\nThat's it. AGENTS.md files in each project reference this loop but do NOT redefine it. The vendor/get-anything-done/ project is the canonical source. Root AGENTS.md and .planning/AGENTS.md are consumers that point here, not parallel definitions.\n\nSkills are methodology documents (SKILL.md) — agents read and follow them. They are not CLI commands or executable plugins. The GAD CLI provides context efficiency. Skills provide methodology.",
    "impact": "Root AGENTS.md mandatory read order must be simplified. Agents should NOT read 15 files on startup — gad snapshot exists for this. AGENTS.md files across vendor projects reference the GAD loop, they don't each define their own version. No memory files, no shadow task lists — TASK-REGISTRY.xml and STATE.xml are the only task tracking."
  },
  {
    "id": "gad-17",
    "title": "Context exhaustion: work through auto-compact, do not stop",
    "summary": "When context window fills, Claude Code auto-compacts. The agent works through it — stopping to start a fresh session is pointless friction. After compaction, run `gad snapshot --projectid &lt;id&gt;` or `gad context` to re-hydrate and continue. The planning docs are what make this possible — STATE.xml next-action and TASK-REGISTRY.xml tell the agent exactly where it was. No fresh sessions, no handoff files, no asking the user to restart.",
    "impact": "Agents never stop work due to context limits. Auto-compact handles it. After compaction: read gad snapshot, continue. gad-04 (capture decisions in planning docs) is what makes auto-compact re-hydration work — the planning docs ARE the durable state."
  },
  {
    "id": "gad-16",
    "title": "GAD does not support subagents until they are formally evaluated",
    "summary": "Spawning fresh agent instances (subagents via the Agent tool in Claude Code, or equivalent in other CLIs) is not part of the GAD workflow. Subagents start cold with no conversation history, burn context re-deriving state from files, introduce coordination overhead, and have uncharacterized failure modes. Until a formal GAD eval measures subagent utility against inline work, they are not a recommended tool. All work happens in a single agent session using the GAD planning loop.",
    "impact": "No GAD skill should instruct an agent to spawn subagents. The Agent tool is not referenced in any SKILL.md. When context limits are approached, the correct response is to finish the current task, update planning docs, commit, and start a fresh session — not to spawn a subagent mid-task."
  },
  {
    "id": "gad-15",
    "title": "portfolio-bare eval uses real agent sessions, not a harness — context_mode is self-declared",
    "summary": "The portfolio-bare eval is a real agent session in a template directory (evals/portfolio-bare/template/) containing only planning docs and requirements — no app code. The agent opens the template in Claude Code or Codex, runs `gad session new [--fresh]` to declare context mode, plans phases from requirements, executes tasks, and writes a trace at the end. No API keys, no execSync harness.",
    "impact": "The eval IS real agent work. context_delta emerges from comparing runs across context modes over time. A task that only appears in loaded runs is one the agent misses cold — the most actionable finding."
  },
  {
    "id": "gad-14",
    "title": "gad state and gad phases default to session project when a session is active",
    "summary": "When no --projectid flag is given, `gad state`, `gad phases`, `gad decisions`, `gad requirements`, `gad errors`, `gad blockers`, and `gad refs` call getActiveSessionProjectId() and scope output to the active session's project. Explicit --projectid overrides. --all bypasses session scope entirely and shows all roots. gad ls always shows all roots unscoped.",
    "impact": "Agents working in a session see only their project by default. Multi-project output via --all or when no session exists. token_reduction improved from 0.874 (v5) to 0.940 (v6)."
  },
  {
    "id": "gad-13",
    "title": "TRACE.json is the machine-readable sidecar for every eval run",
    "summary": "Every eval run directory must contain a TRACE.json alongside RUN.md and SCORE.md. TRACE.json records: workflow (A/B/both), per-command token counts and unit fidelity, unit_coverage map (U1–U12 at Full/Referenced/Truncated/Approximated/Absent), and computed totals. Agents write it using `gad eval trace write` or inline during a run.",
    "impact": "Any new eval run must produce a TRACE.json. The diff command surfaces regressions and improvements per information unit. The report command shows persistent problem units across the full run history."
  },
  {
    "id": "gad-12",
    "title": "Missing-arg UX: print available choices and rerun hint, never a blind error",
    "summary": "All GAD CLI commands that require a --projectid or --id argument must, when absent, print the list of valid choices and a ready-to-run rerun hint on stderr before exiting 1. Blind citty \"Missing required argument\" errors are banned — required: true is replaced with our own check.",
    "impact": "Any future command added to gad.cjs that takes a required project/session/id arg must follow this pattern."
  },
  {
    "id": "gad-11",
    "title": "gad sink is the canonical docs sync command",
    "summary": "`gad sink` owns the four-direction docs sync surface: status (diff), compile (planning→docs), sync (compile all, non-destructive), decompile (ensure dirs, create stubs), validate (mapping health). Sink is manual by default — no auto-compile on file change. Human-authored sink files (no generated: true frontmatter) are never overwritten.",
    "impact": "New code uses `gad sink compile` or `gad sink sync`. sink status shows: ok | stale | missing | human-authored. All 7 registered roots compile to the sink."
  },
  {
    "id": "gad-10",
    "title": "gad snapshot is the one-shot full project context command",
    "summary": "`gad snapshot` inlines every planning file in a project's .planning/ directory (excluding archive/, sessions/, node_modules/). Priority order: STATE, ROADMAP, REQUIREMENTS, DECISIONS, TASK-REGISTRY, then alphabetical. This is the canonical command for handing an agent a complete cold-start context pack. It differs from `gad context` — context gives session-aware minimal refs, snapshot gives everything.",
    "impact": "Agents starting a fresh session on an unfamiliar project use `gad snapshot --projectid <id>`. `gad context` is for ongoing work within a session."
  },
  {
    "id": "gad-09",
    "title": "gad context inlines file contents by default; --refs is the lightweight mode",
    "summary": "The `gad context` command inlines all planning file contents directly into its output by default. This gives agents a single command to get full context without reading files separately. The `--refs` flag restores the lightweight behavior (file paths only). This improves the completeness score on the cli-efficiency eval.",
    "impact": "Agents must use `gad context --refs` when they only want file paths. `gad context` without flags is verbose — suitable for session start, not for routine orientation checks."
  },
  {
    "id": "gad-08",
    "title": "GAD v1.0.0 defining characteristic: skills-first with evaluation",
    "summary": "Pre-1.0 (GSD/ralph-wiggum loop) was workflow-heavy — agents followed long workflow docs. v1.0.0 is skills-first: every skill has an agent-agnostic SKILL.md definition, is evaluated for output quality, and is versioned with the methodology. The CLI provides context efficiency. Evals are scientific. Traces measure what agents retrieve. Domain translators extend GAD to verticals.",
    "impact": "All new skills must have SKILL.md in vendor/get-anything-done/skills/. Skills are evaluated via the eval framework. Methodology version is tracked in package.json gadMethodologyVersion field."
  },
  {
    "id": "gad-07",
    "title": "gad-manuscript is a self-contained domain translator repo",
    "summary": "gad-manuscript is a standalone repo that defines the domain translator pattern — adapts GAD base methodology to book/fiction creation. It owns its own SKILL.md files, evals, and planning docs while referencing gad:* base skills. The magicborn in-world lore content in the docs sink is produced by gad-manuscript skills.",
    "impact": "Domain translator pattern is defined. Other verticals (product, design) follow the same pattern: standalone repo, own skills, own evals, references gad:* base. magicborn docs.project has content-skill = gad-manuscript."
  },
  {
    "id": "gad-06",
    "title": "GAD CLI is format-agnostic: XML, MD, MDX all valid in .planning/",
    "summary": "Sub-repos and .planning/ directories may use XML, MD, or MDX. The GAD CLI must parse all three transparently. The planning sink normalizes to MDX only. compile() converts any format to MDX; decompile() restores the original format. Coding agents and the CLI treat methodology as the constant — format is an implementation detail.",
    "impact": "gad sink validate checks parseability and round-trip fidelity, not format compliance. Any new project may choose its format. XML is preferred when both exist."
  },
  {
    "id": "gad-05",
    "title": "repo-planner is officially a GAD project; rp-* skills are deprecated",
    "summary": "vendor/repo-planner is registered as a GAD root (id=repo-planner) in planning-config.toml. It has a GAD-format .planning/ directory. Its skills (rp-*) are deprecated stubs pointing to gad:* equivalents. The manuscript skill content migrated to vendor/get-anything-done/skills/manuscript/SKILL.md. The portfolio docs remain as the docs sink.",
    "impact": "gad ls shows both global and repo-planner. gad state, phases, and tasks all work for repo-planner. No new rp-* skills should be created."
  },
  {
    "id": "gad-04",
    "title": "All session intents, decisions, and guidance must be captured in planning docs each session",
    "summary": "Every working session that produces new decisions, requirements, or guidance must update DECISIONS.xml and the relevant planning docs before the session ends. Chat context is ephemeral — planning docs are the durable record. The GAD planning loop is the mechanism; this decision makes the capture requirement explicit.",
    "impact": "Agents starting a new session get current decisions from the planning docs, not from reconstructing chat history. Drift between chat intent and planning state is prevented."
  },
  {
    "id": "gad-03",
    "title": "Context = session-variable information units; static docs are exempt from CLI coverage",
    "summary": "Context for agent resumption is defined as the 10 session-variable information units (U1–U10) in DEFINITIONS.md. Static docs (AGENTS.md style guide, planning model reference tables, done-task history) do not constitute context loss if absent from CLI output — they are read once and cached. Context loss occurs only when a unit's absence would cause an agent to make a different next-action decision.",
    "impact": "Completeness scoring is now honest: units present at reduced fidelity (Truncated/Approximated) score 0.5, not 1.0. v3 completeness = 0.85, lower than v2's inflated 0.95."
  },
  {
    "id": "gad-02",
    "title": "Evals capture actual content, not just byte counts — token counts are the primary efficiency metric",
    "summary": "Every eval RUN.md must contain verbatim CLI and raw workflow outputs, a unit-by-unit fidelity table, token counts (chars/4), arithmetic showing all formulas applied, and an agent simulation proving the next-action decision is identical with and without the CLI. Byte counts alone are insufficient because they cannot reveal whether information is actually readable or complete.",
    "impact": "All future eval runs follow the scientific format defined in vendor/get-anything-done/evals/DEFINITIONS.md. v3 is the first run that meets this standard."
  },
  {
    "id": "gad-01",
    "title": "GAD is the universal planning framework — agent-agnostic, not Claude Code-specific",
    "summary": "GAD (get-anything-done) is the single planning framework for all projects in this repo. Skills are methodology documents (SKILL.md) stored in vendor/get-anything-done/skills/ — they must work with any AI coding assistant, not just Claude Code. Claude Code-specific install paths (~/.claude/) are implementation details, not the canonical source.",
    "impact": "All projects register under GAD via planning-config.toml. rp-* skills are deprecated; gad:* skills are canonical. No new framework-specific skill systems are added."
  }
];

export const WORKFLOW_LABELS: Record<Workflow, string> = {
  gad: "GAD",
  bare: "Bare",
  emergent: "Emergent",
};

export const WORKFLOW_DESCRIPTIONS: Record<Workflow, string> = {
  gad: "Full GAD framework: .planning/ XML, AGENTS.md loop, skill triggers, plan/execute/verify cycle.",
  bare: "No framework. Agent builds the game however it wants. Workflow artifacts only mandated to live under game/.planning/.",
  emergent:
    "No framework, but inherits skills from previous bare/emergent runs. Evolves them in place and writes a CHANGELOG.",
};
