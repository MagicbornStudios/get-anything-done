# Agent guide — Escape the Dungeon (bare eval)

You are building a roguelike dungeon crawler game. Your job is to implement the full game
described in `REQUIREMENTS.xml` and deliver a working production build.

## Before you start coding

1. **Read `REQUIREMENTS.xml`** — this is what you're building. Read it carefully.
2. **Read the source docs** — `source-GAMEPLAY-DESIGN.xml` and `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` contain the full game design.
3. **Research the Ralph Wiggum loop** — search the web for "Ralph Wiggum loop AI agents" and "plan-do-check-act coding agents". This is a framework for how AI agents can organize their work. Study what people have built and how they track progress.
4. **Create your own workflow** — based on what you learn, create a system to track your work. You decide the format. Some things to consider:
   - How will you track what's done vs what's left?
   - How will you break the game into manageable pieces?
   - How will you remember architectural decisions you make?
   - How will you verify each piece works before moving on?

Write your workflow system down in a file so you can reference it throughout the build.

## During implementation

- **Use your workflow.** Follow whatever system you created. Update it as you go.
- **When you hit a wall** — if you encounter a problem type you've seen before (e.g. "every time I add a new game system, I need to do X, Y, Z"), write down a reusable pattern or checklist for it. Think of these as "skills" — documented approaches you can reuse.
- **Iterate on your process.** If your tracking system isn't working well, change it. If you find you need a new artifact type, create one. The workflow should evolve with the project.
- **Commit regularly.** Each commit should represent a meaningful unit of work.

## What you are NOT given

- No planning framework or CLI tools
- No pre-built task tracking system
- No predefined workflow or loop
- No skills library

You are responsible for creating whatever organizational structure you need.

## Build and verify

```sh
cd game/
npm install
npm run dev        # dev server
npx tsc --noEmit   # type check
npm run build      # production build
```

## THREE GATE CRITERIA (all must pass or you score 0)

**G1 — Game loop:** Title → New Game → room → navigate → combat → return → continue playing. NO SOFTLOCKS. Previous runs failed here — combat didn't return to room navigation.
**G2 — Spell crafting:** Player accesses a rune forge, combines runes, creates a spell, uses it in combat. Loot/NPC spell rewards do NOT count. You must build a forge UI. Minimum: 3-5 runes, 3+ combinations.
**G3 — UI quality:** Icons, styled buttons, HP bars (not just numbers), room-type visual differentiation, entity sprites/portraits. NO raw ASCII/text-only UI.

## UI ASSET SOURCING

The game must look intentional and polished. Use these approaches:
1. Install an icon/sprite npm package (e.g. game-icons, pixel-art packs)
2. Use web search to find free game sprites/icons and download them
3. Generate placeholder art (canvas-drawn, SVG, emoji-based)
4. Geometric fallback (LAST RESORT only)

## PREVIOUS RUN FAILURES (learn from these)

- **Bare v1:** Main menu rendered but New Game didn't work. KAPLAY buttons need `area()` component for clicks.
- **Bare v2:** Most playable game but UI was raw ASCII. No rune forge. Score: 0.50.
- **GAD v7:** Stuck after combat — no scene transition back to room. Score: 0.30.
- **Emergent v1:** Crashed with "Styled text error: unclosed tags START". Don't use KAPLAY `[tag]` styled text with dynamic content.

Fix ALL of these issues. The bar is higher now.

## Final deliverable (MANDATORY)

Your LAST step must produce a working production build:

1. Run `npm run build` in `game/` — it must succeed with zero errors
2. The `game/dist/` directory must contain a playable `index.html` + assets
3. Verify the build works: the index.html should load in a browser with no 404s
4. Commit the dist/ directory

## Architecture doc (MANDATORY)

Before your final commit, write an `ARCHITECTURE.md` describing what you built:
- System overview (1 paragraph)
- Key modules and what each does
- Data flow
- Key decisions you made and why

10-20 lines is enough. It proves you understand what you built.
