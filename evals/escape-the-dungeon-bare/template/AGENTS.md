# Agent guide — Escape the Dungeon (bare eval)

You are building a roguelike dungeon crawler game. Read `REQUIREMENTS.xml` for what to
build and `source-GAMEPLAY-DESIGN.xml` + `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` for the
game design.

## Project layout

Create the game under `game/`. Put ALL workflow/tracking/notes/decisions/skills files
under `game/.planning/`. Never mix them into source directories.

```
game/
├── .planning/     ← workflow, decisions, skills, notes — whatever format you like
├── src/           ← source code only
├── public/        ← assets
└── package.json, tsconfig.json, etc.
```

## How to work

You don't have a planning framework. Build the game however makes sense to you.
Track your work in `game/.planning/` using whatever format keeps you sane — checklists,
prose, JSON, whatever. Update it as you go so you can pick up where you left off if
you lose context.

When you hit repeated problems, write reusable patterns down in
`game/.planning/skills/` (or wherever in `.planning/` makes sense) so you can reference
them later.

## Gates (all must pass or score 0)

- **G1 Game loop**: Title → New Game → room → navigate → combat → return → keep playing. No softlocks.
- **G2 Spell crafting**: Player accesses a forge, combines runes, creates a spell, uses it in combat. Loot/rewards don't count.
- **G3 UI quality**: Icons, styled buttons, HP bars, room-type visual differentiation, entity representation. No raw ASCII/text-only UI.

## Build and verify

```sh
cd game/
npm install
npm run dev        # verify in browser
npm run build      # production build to dist/
```

Test the full game loop after each phase of work. Don't wait until the end.

## UI assets

Use easily sourced assets: npm icon/sprite packages, free game art from web search,
generated SVG/canvas, or emoji. Make it look intentional, not like a debug console.

## Final deliverable

- `game/dist/` with a working `index.html`
- Full game loop playable in the browser when served via HTTP
- `game/.planning/ARCHITECTURE.md` with a short system overview
