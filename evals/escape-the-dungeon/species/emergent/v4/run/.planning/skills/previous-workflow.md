# Previous Run Results — All Conditions

## Run history (sorted by human review score)

| Run | Condition | Human score | Fatal issue |
|-----|-----------|-------------|-------------|
| Bare v2 | No framework, told about v1 failure | **0.50** | ASCII UI, no rune forge |
| GAD v7 | Full GAD framework | 0.30 | Stuck after combat — no return to room |
| Bare v1 | No framework, first attempt | 0.10 | New Game button didn't work |
| Emergent v1 | Inherited skills from bare v1 | 0.10 | "Styled text error: unclosed tags START" |
| GAD v5-v6 | Full GAD framework | 0.00 | Blank screen (ES module + file://) |

## What the best run (Bare v2) did right

- Full game loop worked: title → new game → rooms → combat → dialogue → navigation
- 6 commits (phase-level, not 1 giant batch)
- Good UX flow and color coding
- Content-driven architecture with JSON packs

## What the best run (Bare v2) did wrong

- Very ASCII UI — no spacing, no icons, plain text
- No rune forge / spell crafting system
- No spell acquisition during gameplay
- Rest rooms don't offer any crafting

## What broke in previous emergent run (v1)

- KAPLAY styled text error: `[color]` tags in text weren't properly closed
- Used `k.go("scene", arg1, arg2)` instead of `k.go("scene", { data })` — KAPLAY v3 only takes one data argument
- Built everything in 1 commit — no checkpoints to roll back to

## Specific errors and fixes

### Error: "Styled text error: unclosed tags START"
**Cause:** KAPLAY's text component interprets `[tag]...[/tag]` as styled text. If you
have unclosed tags or variable values containing `[`, it crashes.
**Fix:** Either escape brackets in dynamic text or use plain `k.text()` without styled
formatting for dynamic content. Only use `[color=red]...[/color]` for static known text.

### Error: New Game button doesn't respond to clicks  
**Cause:** KAPLAY buttons need `k.area()` component for click detection.
**Fix:** Always add `k.area({ cursor: "pointer" })` to clickable elements.

### Error: Scene transition fails silently
**Cause:** `k.go()` with wrong argument format.
**Fix:** Use `k.go("sceneName", { gameState: state })` — single object argument.

### Error: Stuck after combat (no return to room)
**Cause:** Combat scene doesn't have a transition back to room scene after win/lose.
**Fix:** After combat resolution, call `k.go("room", { gameState })` to return to room.
Test this IMMEDIATELY after implementing combat — don't wait until the end.

## Recommendations for this run

1. Read ALL skills in this directory first
2. Build the game loop FIRST: title → new game → room → navigate → interact → return
3. Verify the loop works after EACH phase — use `npm run dev`
4. Don't use KAPLAY styled text `[tags]` with dynamic content
5. After combat/dialogue, ALWAYS transition back to room scene
6. Add spacing and visual hierarchy to UI — not raw ASCII text
7. Commit after each phase, not one giant batch
