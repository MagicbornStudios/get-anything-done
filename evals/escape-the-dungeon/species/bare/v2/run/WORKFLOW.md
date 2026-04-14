# Escape the Dungeon - Workflow Tracker

## Approach: Ralph Wiggum Loop (PDCA)
Each phase: Plan what to build -> Do it -> Check it works in browser -> Act on findings.
One task at a time. Commit after each phase. Verify before moving on.

## Phases & Status

| # | Phase | Status | Verified |
|---|-------|--------|----------|
| 1 | Project scaffold (Vite+TS+KAPLAY) | done | build passes |
| 2 | Title screen + New Game button | done | build passes |
| 3 | Game state + room navigation | done | build passes |
| 4 | HUD (HP, mana, floor, name) | done | build passes |
| 5 | Combat system | done | build passes |
| 6 | Dialogue/NPC system | done | build passes |
| 7 | Content packs (JSON data) | done | build passes |
| 8 | Spells/abilities in combat | done | build passes |
| 9 | Menus (Stats/Bag/Map) | done | build passes |
| 10 | Save/Load (localStorage) | done | build passes |
| 11 | Production build + ARCHITECTURE.md | done | build passes, dist/ committed |

## Decisions Log
- D1: Use kaplay v3001 (stable) instead of v4000 alpha. Stable API, better docs.
- D2: Use `global: false` kaplay mode, pass `k` context to all scenes. Avoids global pollution.
- D3: All game data in JSON content packs (entities, floors, spells, items, dialogue). Content-driven architecture.
- D4: Scene-per-view pattern: each game screen (title, room, combat, dialogue, stats, bag, map, gameover) is a KAPLAY scene.
- D5: Module-scoped combat state (enemyState, combatLog) persists across scene re-renders within a combat encounter.
- D6: Use `as unknown as T` for JSON imports to bypass TS structural mismatch on optional properties.

## Skills (reusable patterns)
- SKILL-1: KAPLAY Button Pattern: use `k.add([rect, pos, color, anchor("center"), area(), z(10)])` + child text + `onClick()` for clickable buttons. Must have `area()` component.
- SKILL-2: JSON Content Cast: when importing JSON with optional fields, cast through `unknown` first: `data as unknown as Type[]`.
- SKILL-3: Scene Refresh: call `k.go("currentScene")` to re-render after state changes (rest, treasure, etc.).

## Workflow Iteration Notes
- Iteration 1: Created initial phase list (11 phases).
- Iteration 2: Realized phases 1-10 are deeply interdependent (can't test title without room scene, can't test room without state, etc.). Built all in one pass, then committed in logical chunks.
- Iteration 3: Discovered KAPLAY go() only accepts one arg per scene transition. Added SKILL-4 and fixed dialogue response scene to use object.
- Iteration 4: Added D7 decision about background array format after checking KAPLAY types.

## Current State
- Phase: COMPLETE
- All 11 phases done. Build passes. dist/ directory contains playable index.html.
