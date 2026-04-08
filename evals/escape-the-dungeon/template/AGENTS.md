# Agent guide — Escape the Dungeon (eval project)

**You are inside a GAD eval.** Follow this loop exactly. Your work is being traced.

## The loop (mandatory)

1. **Read context:** `gad snapshot --projectid escape-the-dungeon` or read `.planning/STATE.xml`
2. **Pick one task** from `.planning/TASK-REGISTRY.xml` (status=planned)
3. **Mark it in-progress** in TASK-REGISTRY.xml before starting work
4. **Implement it**
5. **Mark it done** in TASK-REGISTRY.xml
6. **Update STATE.xml** — set `next-action` to describe what comes next
7. **Commit exactly one task per commit.** Message MUST include the task id (e.g. "feat: 02-03 render floor map"). NEVER batch multiple tasks into one commit -- each task gets its own atomic commit. This is how your discipline is scored.
8. **Repeat** from step 2

## After completing each phase (all tasks done)

**Verify the phase before moving on.** Write `.planning/VERIFICATION.md` (append each phase):

```markdown
## Phase [X]: [Name]
- Build: PASS/FAIL (run the build command)
- Tasks: [N]/[N] done
- State: current (next-action points to next phase)
```

Then commit: `git commit -m "verify: phase [X] verified"`

This is mandatory — your skill accuracy score depends on it.

## Before you start coding

You MUST do these first:
1. Read `.planning/REQUIREMENTS.xml` — what you're building
2. Read the source docs — `source-GAMEPLAY-DESIGN.xml` and `source-STAT-AND-BEHAVIOUR-TAXONOMY.md`
3. Plan your phases in `.planning/ROADMAP.xml` (it's empty — you plan from scratch)
4. Create tasks in `.planning/TASK-REGISTRY.xml` for your first phase

## BUILD ORDER: UI FIRST, SYSTEMS SECOND

**Your #1 priority is a playable vertical slice.** A game with 3 rooms and visible UI
scores higher than 12 invisible backend systems. Plan your phases in this order:

1. **Project scaffold** — Vite + KAPLAY + TypeScript, dev server running
2. **Title screen + game start** — visible styled menu, "New Game" works
3. **Room navigation** — styled rooms with icons, themed colors per room type, exit buttons
4. **Combat encounter** — visible HP bars, styled action buttons, enemy representation (sprite/portrait/placeholder)
5. **Rune forge / spell crafting** — player combines runes to create spells (THIS IS A GATE — IT MUST WORK)
6. **Dialogue** — NPC portrait/representation, dialogue text, choice buttons
7. **HUD + menus** — HP/mana bars (not just numbers), styled overlay menus
8. **Content packs + save/load** — JSON data, localStorage persistence
9. **Polish pass** — verify full game loop, visual consistency, no softlocks

## THREE GATE CRITERIA (all must pass or you score 0)

**G1 — Game loop:** Title → New Game → room → navigate → combat → return → continue playing. NO SOFTLOCKS.
**G2 — Spell crafting:** Player accesses forge, combines runes, creates a spell, uses it. Loot/rewards don't count.
**G3 — UI quality:** Icons, styled buttons, HP bars, room-type visual differentiation, entity representation. NO raw ASCII/text-only UI.

If you build systems without UI, the game will show a blank screen and score 0.
If combat doesn't return to room navigation, you score 0.
If there's no rune forge, you score 0.

## UI ASSET SOURCING

You MUST make the game visually polished. Use these approaches (in order of preference):
1. Install an icon/sprite npm package (e.g. game-icons, pixel-art packs)
2. Use web search to find free game sprites/icons and download them
3. Generate placeholder art (canvas-drawn shapes, SVG icons, emoji-based)
4. Geometric fallback tiles (LAST RESORT only)

The game must look intentional, not like a debug console.

## Per-task checklist

Before moving to the next task, verify:
- [ ] TASK-REGISTRY.xml: previous task marked `done`
- [ ] STATE.xml: `next-action` updated
- [ ] Code compiles (`npx tsc --noEmit` or equivalent)
- [ ] Committed with task id in message

## After first implementation phase

If this is a greenfield project and no `CONVENTIONS.md` exists yet:
- Create `.planning/CONVENTIONS.md` documenting the patterns you established:
  - File structure and naming
  - Import/export patterns
  - Content pack format
  - Scene/component registration pattern
  - Type conventions

## Decisions during work

When you make an architectural choice (e.g. "use Vite not Webpack", "scenes are functions not classes"), capture it in `.planning/DECISIONS.xml`:

```xml
<decision id="etd-01">
  <title>Short title</title>
  <summary>What you decided and why</summary>
  <impact>How this affects future work</impact>
</decision>
```

## What NOT to do

- Do NOT skip TASK-REGISTRY.xml updates — your trace depends on them
- Do NOT batch all planning updates at the end — update per task
- Do NOT batch multiple tasks into one commit — ONE task = ONE commit. This is 20% of your score
- Do NOT ignore STATE.xml — it's how the next agent knows where you stopped
- Do NOT code without planning first — phases and tasks must exist before implementation

## Source material

- `source-GAMEPLAY-DESIGN.xml` — full game design (640 lines)
- `source-STAT-AND-BEHAVIOUR-TAXONOMY.md` — stat names and engine mappings
- `.planning/phases/01-pre-planning/01-CONTEXT.md` — pre-planning decisions

## Build and verify

```sh
cd game/
npm run dev        # dev server
npx tsc --noEmit   # type check
npm run build       # production build
```

## Final deliverable (MANDATORY)

Your LAST phase must produce a working production build. This is non-negotiable:

1. Run `npm run build` in `game/` — it must succeed with zero errors
2. The `game/dist/` directory must contain a playable `index.html` + assets
3. Verify the build works: the index.html should load in a browser with no 404s
4. Commit the dist/ directory: `git add game/dist/ && git commit -m "build: production dist"`

The build artifact is what gets showcased on the docs site. No dist = eval incomplete.

## Architecture doc (MANDATORY)

Before your final commit, write `.planning/ARCHITECTURE.md` describing what you built:
- System overview (1 paragraph)
- Key modules and what each does (bullet list)
- Data flow (how game state moves through the system)
- Key decisions you made and why

This is scored. 10-20 lines is enough. It proves you understand what you built, not just that it compiles.
