# Escape the Dungeon — Emergent v2 Workflow

## Phase plan

1. **Scaffold + Core Loop** (DONE) — Project setup, all scenes, full game loop
2. **Bug Fixes + Polish** (DONE) — Fix canvas init, tick logic, hover safety
3. **Verification** — Walk through all 3 gates, fix any issues
4. **Skills + Docs** — Write ARCHITECTURE.md, update skills, CHANGELOG.md
5. **Production Build** — Final dist, commit

## Inherited skills used

- kaplay-scene-pattern: destroyAll re-render, area() on all buttons
- content-pack-loading: fetch from public/data/ with fallback
- state-composition: NaN prevention, currentHp = maxHp init
- game-loop-verification: verify after each phase
- previous-workflow: all error patterns avoided

## Key decisions

1. Let KAPLAY manage its own canvas (not custom createElement)
2. Scene data always passed as single object: `k.go("scene", { gameState })`
3. No KAPLAY styled text tags — all text is plain to avoid crash
4. Combat ALWAYS returns to room scene (fixes GAD v7 bug)
5. Tick increment on scene entry only, not on UI re-render
6. Canvas-drawn icons instead of ASCII — colored circles + letters
