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

You start with two inherited skills in `skills/`:

- **`create-skill.md`** — how to capture a working pattern as a reusable skill doc.
  Use this whenever you solve something non-obvious.
- **`find-sprites.md`** — how to source coherent visual assets so the UI doesn't fail
  the quality gate.

Copy them into `game/.planning/skills/` and use them. When you hit repeated problems,
write a new skill there using the `create-skill` pattern. That's how your workflow
evolves.

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

Test the full game loop after each phase of work. Don't wait until the end.

## UI assets

Use easily sourced assets: npm icon/sprite packages, free game art from web search,
generated SVG/canvas, or emoji. Make it look intentional, not like a debug console.

## Final deliverable

- `game/dist/` with a working `index.html`
- Full game loop playable in the browser when served via HTTP
- Whatever you put in `game/.planning/` to make the run reproducible

That's the contract. How you organize work and what artifacts you author beyond that
is yours to decide.
