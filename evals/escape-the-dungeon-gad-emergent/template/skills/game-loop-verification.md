# Skill: Game Loop Verification

**Source:** escape-the-dungeon experiment findings (2026-04-08)
**Category:** Workflow
**Version:** 1

## Pattern

After each phase of implementation, verify the COMPLETE game loop works end-to-end.
Do not move to the next phase until this passes.

## The verification cycle

Run `npm run dev`, open browser, and walk through:

1. Title screen loads (not blank)
2. Click "New Game" → game starts (scene transition works)
3. See current room with description and navigation options
4. Click an exit → move to another room (navigation works)
5. If combat room: combat starts → fight → win/lose → return to room view
6. If dialogue room: dialogue starts → choose option → return to room view
7. Can continue navigating after any encounter (not stuck)

## When to use

After EVERY phase that changes scene flow, state management, or UI rendering.
Especially after adding combat, dialogue, or any new interaction type.

## Failure modes from previous runs

- **GAD v7:** Combat worked but player got stuck after combat — no route back to room
  navigation. The scene transition from combat → room was missing or broken.
  
- **Bare v1:** Main menu rendered but New Game button didn't start the game. Scene
  transition from title → game was broken.
  
- **Emergent v1:** "Styled text error: unclosed tags START" crashed the game on room
  entry. Text formatting in KAPLAY was malformed.

## Key principle

**A game that renders a title screen but can't be played scores almost zero.**
Build the full loop first (title → room → navigate → interact → return), THEN add
features. Never add a new system without verifying the loop still works.
