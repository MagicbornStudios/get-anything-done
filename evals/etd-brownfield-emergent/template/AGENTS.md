# Agent guide — Escape the Dungeon (emergent brownfield)

**This is a brownfield + emergent eval.** You inherit TWO things:
1. A working codebase from `escape-the-dungeon-bare v3`
2. Skills and workflow lessons from previous emergent runs

Your job is to extend the codebase using your inherited workflow, and evolve the workflow
as you learn new things.

## Starting state

At `game/` you'll find the bare v3 codebase. Existing workflow files may be at
`game/.planning/` (from the previous run). The template also provides inherited skills
in `skills/` — copy them into `game/.planning/skills/` at the start.

## Project layout

All workflow/tracking/skills/decisions go under `game/.planning/`.

```
game/
├── .planning/
│   ├── skills/            ← inherited + new skills
│   │   ├── CHANGELOG.md   ← what you changed
│   │   └── ...
│   └── ...                ← any other workflow files
├── src/                   ← existing code — extend it
├── public/                ← existing assets
└── package.json, etc.
```

## How to work

Use your inherited workflow. Improve it. Create new skills in `game/.planning/skills/`
when you encounter new problems. Update existing skills if they're wrong or incomplete.
At the end, write `game/.planning/skills/CHANGELOG.md` documenting what evolved.

## What to build

Read `REQUIREMENTS.md` (the brownfield v4 extensions). The gates are:

- **G1 Floor progression**
- **G2 Respawning encounters**
- **G3 Rune forge with affinity**
- **G4 Skills system** (physical, supercharge with crystals)
- **G5 Visual upgrade** (real sprites, no ASCII)

Plus retained v3 gates (game loop, spell crafting, UI quality).

## Final deliverable

- `game/dist/` that works over HTTP
- All gates pass
- Workflow docs in `game/.planning/` including `skills/CHANGELOG.md`
