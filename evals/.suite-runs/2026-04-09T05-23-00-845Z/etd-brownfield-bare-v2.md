# Eval: etd-brownfield-bare v2


**Mode:** brownfield | **Workflow:** bare



You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## BROWNFIELD BASELINE

This is a brownfield eval. Before coding, copy the baseline codebase into `game/`:

```sh
mkdir -p game
cp -r vendor/get-anything-done/evals/escape-the-dungeon-bare/v3/run//* game/ 2>/dev/null || true
cp -r vendor/get-anything-done/evals/escape-the-dungeon-bare/v3/run//.planning game/.planning 2>/dev/null || true
cd game && npm install
```

The baseline is **escape-the-dungeon-bare v3** — a working roguelike you must EXTEND, not replace.
Read existing files before changing them. Preserve what works. Add new features on top.


## AGENTS.md (follow this exactly)

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


## REQUIREMENTS.md (eval overview)

# Brownfield extensions (v4)

Shared extension requirements for all `etd-brownfield-*` evals. These describe what
features to ADD to the existing bare v3 codebase (which you inherit as the starting state).

**Baseline:** `escape-the-dungeon-bare v3` — a playable roguelike with title, rooms,
combat, dialogue, menus, save/load, and content packs. Missing: floor progression,
rune forge, skills system, rich visuals.

**Your job:** Extend this codebase with the features below. Do NOT rebuild from scratch.
Keep what works, fix what's broken, and add the new systems.

## Required additions (gates)

### G1 — Floor progression
- After defeating the floor boss, player unlocks the next floor
- New floor has new rooms, new enemies, potentially new room types
- Progress is saved (can continue to unlocked floors after reload)
- Player can backtrack to previous floors if desired

### G2 — Respawning encounters (grinding)
- Combat rooms on a cleared floor can be re-entered to fight respawned enemies
- Respawn cadence is balanced (not every entry, but reasonable for XP farming)
- This lets players grind for XP, crystals, and rune affinity before taking on bosses

### G3 — Rune forge with affinity system
- Player can access the forge at forge rooms OR a mana crystal cost at any rest room
- Select 2+ runes to craft a spell. The resulting spell reflects the runes chosen
- **Rune affinity**: each rune the player uses in combat builds affinity for that rune
- Higher affinity unlocks stronger spell variants ("evolutions") that require minimum
  affinity thresholds
- **Specialization vs decay**: affinity in unused runes slowly decays, so players choose
  a specialization rather than maxing everything
- Player can train affinity at the forge by spending XP (cheaper than combat grinding)
- Player can author their own spell names and save them to the spellbook

### G4 — Skills system (physical actions, separate from spells)
- Skills are physical actions: Slash, Bash, Parry, Guard, etc.
- Skills cost nothing (no mana) but have cooldowns or turn delays
- Skills gain XP through use and evolve via their own skill experience (not rune affinity)
- Skills can be **supercharged by expending mana crystals** to add extra damage or effects
  (e.g., burn, bleed, stun, knockback)
- Minimum: 3 starter skills, at least 1 that evolves, at least 1 that can be supercharged

### G5 — Visual upgrade
- Source and use actual sprites/tilesets (install an npm package or web-search for free
  assets). No raw ASCII/text-only UI.
- Room-type icons, entity sprites/portraits, HP/mana bars, styled panels

## Retained from v3 gates

- **Game loop** must still work end-to-end: title → new game → rooms → combat → return
- **Spell crafting** from v3 — crafted spells should now interact with the new affinity
  system
- **UI quality** remains a gate

## Nomenclature update

In the game UI, display narrative/progression stats as **"Traits"** (not "Narrative Stats").
The code can still use `narrativeStats` internally, but the player-facing label is "Traits".

## What NOT to do

- Don't rewrite working v3 code unless you have to
- Don't introduce new frameworks beyond what v3 already uses
- Don't silently break existing gates — if a v3 feature stops working, that's a regression

## Scoring

Same v3 composite formula with human_review weighted 0.30. Gate violations zero the
requirement_coverage. The low-score caps still apply.

## Baseline code location

The bare v3 codebase is at `vendor/get-anything-done/evals/escape-the-dungeon-bare/v3/run/`.
For brownfield evals, this directory's contents are copied into `game/` at the start of
the run as your starting point.



## Instructions


1. Copy the .planning/ directory from the template into your working directory

2. Implement the project following the ROADMAP.xml phases

3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID — one commit per task, not per phase

4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture

4b. Capture decisions AS YOU MAKE THEM — if you chose between alternatives (library, pattern, data model), write a <decision> to DECISIONS.xml before committing that task. Aim for 1-2 per phase minimum.

5. After EACH phase completes: write/append to .planning/VERIFICATION.md (build result, task count, state check), commit with "verify: phase X verified"

6. When complete: all phases done, build passes, planning docs current

7. FINAL STEP: produce a production build (dist/ directory) and commit it. The build artifact is showcased on the docs site. No dist = eval incomplete.


## Logging


Set GAD_LOG_DIR to your eval run directory before running gad commands.

All gad CLI calls and tool uses will be logged to JSONL files for eval tracing.

```sh
export GAD_LOG_DIR=<eval-run-dir>/.gad-log
```