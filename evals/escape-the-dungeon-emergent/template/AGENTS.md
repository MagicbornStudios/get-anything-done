# Agent guide — Escape the Dungeon (emergent methodology)

You are building a roguelike dungeon crawler game. This is a continuation of a previous
attempt. You have inherited skills and a workflow from the last run — read them first.

## Before you start coding

1. **Read `skills/previous-workflow.md`** — learn what worked and what failed last time.
2. **Read all files in `skills/`** — these are reusable patterns from the previous run.
3. **Read `REQUIREMENTS.xml`** — what you're building. Same game, same requirements.
4. **Read the source docs** — `source-GAMEPLAY-DESIGN.xml` and `source-STAT-AND-BEHAVIOUR-TAXONOMY.md`.
5. **Create or update your workflow** — based on what you learned from the previous run's failures:
   - The last run produced a main menu but the game didn't start when clicking New Game.
   - The last run wrote everything in 1 commit with no verification between phases.
   - Fix these problems in your workflow before you start coding.

Write your workflow to a file (e.g. `WORKFLOW.md`) and ACTUALLY UPDATE IT as you work.

## During implementation

- **Use your inherited skills.** The `skills/` directory has patterns from the last run. Use them.
- **Verify after each phase.** The last run didn't verify and bugs accumulated silently. After each phase, run the game and confirm it works. If something breaks, fix it before moving on.
- **Create new skills when you hit problems.** If you encounter a new pattern or fix a tricky bug, write it down in `skills/` immediately — not after the fact.
- **Update existing skills if they're wrong.** If an inherited skill doesn't work or could be better, update it.
- **Commit after each phase at minimum.** The last run had 1 giant commit. Do better.
- **Test the New Game flow early.** The last run's main menu rendered but New Game didn't work. Make sure the full flow works: title → new game → room → interaction.

## What you are NOT given

- No planning framework or CLI tools
- No pre-built task tracking system (but you have the previous run's workflow as reference)
- You ARE given skills from the previous run — use and improve them

## Build and verify

```sh
cd game/
npm install
npm run dev        # dev server — USE THIS to verify each phase
npx tsc --noEmit   # type check
npm run build      # production build
```

**IMPORTANT:** After each phase, run `npm run dev` and open the browser to verify the game works. Do NOT wait until the end to check.

## THREE GATE CRITERIA (all must pass or you score 0)

**G1 — Game loop:** Title → New Game → room → navigate → combat → return → continue playing. NO SOFTLOCKS. The previous emergent run crashed entering the game. The GAD run got stuck after combat.
**G2 — Spell crafting:** Player accesses a rune forge, combines runes, creates a spell, uses it. Loot/rewards do NOT count. Minimum: 3-5 runes, 3+ combinations. No previous run has built this — you need to.
**G3 — UI quality:** Icons, styled buttons, HP bars, room-type visual differentiation, entity representation. NO raw ASCII/text-only UI. The best previous run (bare v2) was "very ASCII" and scored 0.50. Beat that.

## UI ASSET SOURCING

The game must look intentional. Use these approaches:
1. Install an icon/sprite npm package
2. Web search for free game sprites/icons
3. Generate placeholder art (canvas-drawn, SVG, emoji-based)
4. Geometric fallback (LAST RESORT)

## Final deliverable (MANDATORY)

1. Run `npm run build` in `game/` — must succeed with zero errors
2. `game/dist/` must contain a playable `index.html`
3. Full game loop must work: title → new game → rooms → combat → forge → return → continue
4. Commit the dist/ directory

## Architecture doc (MANDATORY)

Write `ARCHITECTURE.md` — system overview, key modules, data flow, decisions. 10-20 lines.

## Skill evolution

After completing the game, review your skills:
- Which inherited skills did you actually use?
- Which did you improve?
- What new skills did you create?
- Write a `skills/CHANGELOG.md` documenting what changed and why.

This changelog is how the next run learns from your experience.
