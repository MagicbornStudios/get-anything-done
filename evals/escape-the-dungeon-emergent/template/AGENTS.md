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

## Bootstrap skills you always inherit

Every emergent run includes at least these two skills (in addition to any
domain-specific skills from previous runs):

- **`create-skill.md`** — how to capture reusable patterns as skill documents.
- **`find-sprites.md`** — how to source coherent visual assets so the UI doesn't fail
  the quality gate.

Read all inherited skills before writing code. Apply them, rewrite them in place when
they're wrong, delete them when they encode bad patterns, and write new ones with
`create-skill` whenever you solve a non-obvious problem.

## Gates (all must pass or score 0)

See `REQUIREMENTS.xml` for the authoritative version. Summary:

- **G1 Game loop**: Title → New Game → room → navigate → combat → return → at least 3 room transitions, no softlock.
- **G2 Forge with ingenuity payoff**: Functional spell crafting AND at least one encounter per floor where the crafted/adapted spell provides a meaningful advantage. Loot-granted spells do NOT satisfy this gate.
- **G3 UI quality**: Icons, styled controls, HP/mana bars, room-type differentiation, sprite/portrait representation. Use the `find-sprites` skill. Raw ASCII fails.
- **G4 Pressure mechanics**: At least two systems (resource / counterplay / encounter design / build) that make baseline starter abilities insufficient to brute-force a floor. At least one must interact with the forge.

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
- `game/.planning/skills/CHANGELOG.md` — what you evolved from the inherited skills

Beyond that, the shape of `game/.planning/` is yours to decide.
