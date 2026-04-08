# Agent guide — Escape the Dungeon (GAD brownfield)

**This is a brownfield eval.** You inherit a working codebase from `escape-the-dungeon-bare v3`
and must EXTEND it with new features — not rebuild from scratch.

## Starting state

At `game/` you'll find the bare v3 codebase: title screen, rooms, combat, dialogue, menus,
save/load, content packs. It's a playable roguelike. Your job is to add more features
without breaking what works.

Existing files include:
- `game/src/` — scenes, systems, data
- `game/public/data/` — JSON content packs (floors, enemies, npcs, items, spells, runes)
- Existing workflow docs may be in `game/.planning/` — read them if present

## Your framework: full GAD

Use the GAD loop: plan phases in ROADMAP.xml, create tasks in TASK-REGISTRY.xml, execute
one task at a time with atomic commits, update STATE.xml next-action, capture decisions.
All workflow artifacts go under `game/.planning/`.

```
game/
├── .planning/
│   ├── REQUIREMENTS.xml      ← the brownfield extension spec (copied from template)
│   ├── ROADMAP.xml           ← plan your phases
│   ├── TASK-REGISTRY.xml     ← track tasks
│   ├── STATE.xml             ← current phase + next-action
│   ├── DECISIONS.xml         ← architecture decisions
│   └── VERIFICATION.md       ← phase verification
├── src/                      ← existing code — extend it
├── public/                   ← existing assets
└── package.json, etc.
```

## What to build

Read `game/.planning/REQUIREMENTS.xml` (the brownfield v4 extensions). The gates are:

- **G1 Floor progression** — unlock floor 2+ after defeating boss, saves progress
- **G2 Respawning encounters** — grind-friendly combat rooms
- **G3 Rune forge with affinity** — train runes, evolve spells via thresholds
- **G4 Skills system** — physical actions, evolve via XP, supercharge with crystals
- **G5 Visual upgrade** — real sprites, no ASCII

Plus retained v3 gates (game loop, spell crafting, UI quality).

## Commit discipline

ONE commit per task with task ID in the message. Never batch. This is how your discipline
is scored. Use `git log` to see what bare v3 already committed before you — your commits
build on top of that history.

## Final deliverable

- `game/dist/` production build that works over HTTP
- All gates pass
- Planning docs current
- Brownfield: measured against how much the codebase improved from v3 baseline
