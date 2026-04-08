# Agent guide — Escape the Dungeon (emergent methodology)

You are building a roguelike dungeon crawler game. This is a continuation of a previous
run — you inherit its skills and lessons. Your job is to build on them.

## Start here

1. Read everything in the `skills/` directory from the template — these are patterns
   and failure notes from the previous run. Pay special attention to any files about
   what went wrong and how to fix it.
2. Copy those skills into `game/.planning/skills/` so you can evolve them in place.
3. Read `REQUIREMENTS.xml` and the source docs (`source-GAMEPLAY-DESIGN.xml`,
   `source-STAT-AND-BEHAVIOUR-TAXONOMY.md`).

## Project layout

Create the game under `game/`. Put ALL workflow/tracking/decisions/skills files under
`game/.planning/`. Never mix them into source directories.

```
game/
├── .planning/
│   ├── skills/         ← inherited + new skills you create
│   ├── CHANGELOG.md    ← what you changed from inherited skills
│   └── ... (any other workflow files you want)
├── src/                ← source code only
├── public/             ← assets
└── package.json, etc.
```

## How to work

You inherit a workflow from the previous run. Use it. Improve it. Fix anything that
didn't work last time. When you hit a new problem, write a new skill in
`game/.planning/skills/` immediately — not after the fact.

Track your work in `game/.planning/` using whatever format helps you stay organized.
At the end, write `game/.planning/skills/CHANGELOG.md` documenting what you changed
from the inherited set — that's how the next run learns.

## Gates (all must pass or score 0)

- **G1 Game loop**: Title → New Game → room → navigate → combat → return → keep playing. No softlocks.
- **G2 Spell crafting**: Player accesses a forge, combines runes, creates a spell, uses it. Loot/rewards don't count.
- **G3 UI quality**: Icons, styled buttons, HP bars, room-type visual differentiation, entity representation. No raw ASCII.

## Build and verify

```sh
cd game/
npm install
npm run dev        # verify in browser
npm run build      # production build to dist/
```

Verify the game after each phase. Don't wait until the end — the previous run's failure
mode was accumulating bugs silently.

## UI assets

Use easily sourced assets: npm icon/sprite packages, free game art from web search,
generated SVG/canvas, or emoji. Make it look intentional.

## Final deliverable

- `game/dist/` with a working `index.html`
- Full game loop playable in the browser when served via HTTP
- `game/.planning/ARCHITECTURE.md`
- `game/.planning/skills/CHANGELOG.md` — what you evolved from the inherited skills
