# Skills CHANGELOG -- emergent v5 (2026-04-09)

Previous emergent run (v4) scored TBD. Previous best was bare v2 (0.50, DOM-based).
This run inherits the 7 template skills plus 2 v4-authored skills (9 total).

## Summary

Nine skills inherited. Five kept as-is (proven correct), one kept with narrowed scope,
two deprecated for this domain, one evolved. Two new skills authored for v5-specific patterns.

## Inherited skills -- dispositions

| File | Action | Rationale |
|---|---|---|
| `create-skill.md` | **KEPT** | Core meta-skill. Still correct, still essential. Used it to author two new skills. |
| `find-sprites.md` | **KEPT** | Correct and load-bearing. Drove Tier 1 choice: `iconify-icon` web component + `@iconify-json/game-icons`. Every room, enemy, spell, and UI element uses game-icons. No Tier 5 (ASCII) anywhere. |
| `content-pack-loading.md` | **KEPT** | Applied verbatim. `import.meta.env.BASE_URL` prefix, `public/data/floors.json`, try/catch with fallback. Verified `dist/data/floors.json` exists after build. |
| `game-loop-verification.md` | **KEPT** | Core workflow principle. Applied after every phase: title loads, new game starts, rooms render, navigation works, combat starts/resolves/returns, forge crafts, merchant sells, dialogue branches, boss gates descend, victory screen shows. |
| `previous-workflow.md` | **KEPT** | Historical reference. Informed key decisions: avoid KAPLAY, commit often, build loop first. All three lessons honored. |
| `dom-over-kaplay.md` | **KEPT** | The single highest-leverage inherited skill. Built the entire game as DOM + CSS + TypeScript with `iconify-icon` web components. Zero KAPLAY. Zero canvas. Zero styled-text bugs. The v4 author's advice "Trust `dom-over-kaplay.md`" was correct. |
| `pressure-forge-coupling.md` | **EVOLVED** | v4 mapped F1=direct-resist and F2=reflect. v5 adds a THIRD pressure mechanic: hunger (increases over time/movement/combat, reduces stats). Also added mana-drain (Manaweaver enemy) as a floor-2 specific pressure. The core pattern (floor constraint -> forge counter) remains valid and was applied exactly. |
| `kaplay-scene-pattern.md` | **DEPRECATED** | Third consecutive run where KAPLAY was skipped entirely. The skill is not wrong for real-time games, but for this eval's UI-heavy roguelike domain it has been obsoleted by `dom-over-kaplay.md` for three runs running. Kept for lineage tracing only. |
| `state-composition.md` | **DEPRECATED (scope)** | The archetype + baseStats composition pattern was not needed -- v5 uses direct stat assignment with equipment bonuses and skill-tree bonuses computed at query time via `getEffectiveStats()`. The warning about `NaN` and `currentHp = maxHp` initialization was honored. The skill's core idea (compose stats from multiple sources) is now subsumed by the `getEffectiveStats` pattern in the codebase. |

## New skills authored

### `auto-resolve-combat.md` (NEW)
Captures the Unicorn Overlord auto-resolve pattern that v5 requires (R-v5.13).
Separates combat into SETUP (loadout + policies) and EXECUTION (timer-driven
auto-play with visible log). Documents the policy-driven AI decision function,
the pause/resume mechanic, and the 800ms turn timer. This skill is v5-specific
but applicable to any future turn-based eval that wants combat to feel strategic
rather than mechanical.

### `trait-driven-gameplay.md` (NEW)
Captures the visible numeric trait system (R-v5.14). Documents how traits are
stored (0.0-1.0 floats), how they shift (dialogue, moral choices), and how they
affect gameplay (enemy AI damage scaling, NPC responses, end-screen display).
Explains why visible numbers matter vs hidden traits.

## Skill evolution graph

```
Template (7 skills)
  |
  v4 added: dom-over-kaplay, pressure-forge-coupling
  |
  v5: KEPT 5, EVOLVED 1 (pressure-forge-coupling), DEPRECATED 2, NEW 2
  |
  Total active skills: 8 (5 inherited-kept + 1 evolved + 2 new)
  Deprecated: 2 (kaplay-scene-pattern, state-composition)
```

## What I'd want the next run (v6) to know

1. **Trust the active skill set.** The 8 active skills cover: project setup
   (find-sprites, content-pack-loading), architecture (dom-over-kaplay),
   combat (auto-resolve-combat, pressure-forge-coupling), narrative
   (trait-driven-gameplay), workflow (game-loop-verification, create-skill).

2. **The forge is load-bearing.** G2 (ingenuity) fails if the forge is decorative.
   The pressure-forge-coupling skill documents the exact mapping. Honor it.

3. **Hunger as third pressure mechanic.** v5 added hunger (increases on movement
   and combat turns, reduces attack/defense when high). This creates time pressure
   that wasn't present in v4. Consider evolving this into its own skill if the
   next version needs more pressure mechanics.

4. **Auto-resolve combat is the correct pattern for this eval domain.** Don't
   revert to manual turn-by-turn combat. The setup+execution split is what makes
   the loadout and forge systems matter.

5. **Session persistence via localStorage works.** `saveGame` on every state
   change, `loadGame` on startup. Re-inject static data refs on load. Handle
   missing fields for save compatibility across versions.

6. **Single JSON file for all dungeon content.** `public/data/floors.json` has
   floors, rooms, enemies, runes, recipes, starter spells, and skill tree.
   One file = one fetch = fast iteration.

## Files

```
game/.planning/skills/
+-- CHANGELOG.md                    (this file)
+-- auto-resolve-combat.md          (NEW -- v5 Unicorn Overlord pattern)
+-- content-pack-loading.md         (inherited, kept)
+-- create-skill.md                 (inherited, kept)
+-- dom-over-kaplay.md              (inherited from v4, kept)
+-- find-sprites.md                 (inherited, kept)
+-- game-loop-verification.md       (inherited, kept)
+-- kaplay-scene-pattern.md         (inherited, deprecated for this domain)
+-- pressure-forge-coupling.md      (inherited from v4, evolved)
+-- previous-workflow.md            (inherited, kept)
+-- state-composition.md            (inherited, deprecated scope)
+-- trait-driven-gameplay.md        (NEW -- v5 trait system)
```
