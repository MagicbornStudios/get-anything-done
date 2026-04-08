# Agent guide — Escape the Dungeon (bare brownfield)

**This is a brownfield eval.** You inherit a working codebase from `escape-the-dungeon-bare v3`
and must EXTEND it with new features — not rebuild from scratch.

## Starting state

At `game/` you'll find the bare v3 codebase: title screen, rooms, combat, dialogue, menus,
save/load, content packs. Your job is to add more features.

Existing workflow docs may be in `game/.planning/` (from the previous bare run). Read them
if present — they tell you what the previous agent did and why.

## Project layout

Put ALL workflow/tracking/decisions/notes files under `game/.planning/`. Never mix them
into source directories.

```
game/
├── .planning/     ← your workflow files (any format you like)
├── src/           ← existing code — extend it
├── public/        ← existing assets
└── package.json, etc.
```

## How to work

You don't have a planning framework. Track your work in `game/.planning/` using whatever
format keeps you sane. Build on what's already there. Fix what's broken. Add the new
features described in `REQUIREMENTS.md`.

## What to build

Read `REQUIREMENTS.md` (the brownfield v4 extensions). The gates are:

- **G1 Floor progression**
- **G2 Respawning encounters**
- **G3 Rune forge with affinity**
- **G4 Skills system** (physical, supercharge with crystals)
- **G5 Visual upgrade** (real sprites, no ASCII)

Plus retained v3 gates (game loop, spell crafting, UI quality).

## Build and verify

```sh
cd game/
npm install        # may already be done
npm run dev        # verify in browser
npm run build      # production build
```

Verify after each phase of work. Don't wait until the end.

## Final deliverable

- `game/dist/` that works over HTTP
- All gates pass
- Workflow docs in `game/.planning/`
