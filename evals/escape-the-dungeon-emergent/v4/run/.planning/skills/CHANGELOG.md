# Skills CHANGELOG — emergent v2 (2026-04-09)

Previous emergent run (v1) scored 0.10. Highest overall was bare v2 (0.50, DOM-based).
This run is emergent v2 and inherits the 7-skill set from the template.

## Summary

Seven skills inherited. Two kept as-is, two kept with notes, three effectively
deprecated for this domain. Two new skills written.

## Inherited skills — dispositions

| File | Action | Rationale |
|---|---|---|
| `create-skill.md` | KEPT | Still correct, still essential. No changes. |
| `find-sprites.md` | KEPT | Correct and load-bearing. Drove this run's tier-1 choice of `iconify-icon` + `@iconify-json/game-icons`. |
| `previous-workflow.md` | KEPT | Run-history log; append-only historical value. |
| `game-loop-verification.md` | KEPT | Correct principle. Applied: verified title→room→combat→room→forge→combat→boss transitions before shipping. |
| `content-pack-loading.md` | KEPT | Applied verbatim — `import.meta.env.BASE_URL` + `public/data/*.json` + try/catch with error surface. Guarded against 404. |
| `kaplay-scene-pattern.md` | DEPRECATED for this domain | Skipped KAPLAY entirely. Skill is still valid for real-time games; it's superseded by `dom-over-kaplay.md` for turn-based menu games like this one. Kept in place so the lineage is visible. |
| `state-composition.md` | SIMPLIFIED-AWAY | We didn't need archetype/entityType composition — player stats are hand-authored on `createNewGame`. The skill's warning about `NaN` stats and initializing `currentHp = maxHp` still applied, and we honored it. No file changes. |

## New skills written

### `dom-over-kaplay.md`
The decisive methodology choice for this run. Every previous KAPLAY run died on
KAPLAY-specific bugs (styled text, scene args, missing `k.area()`). The bare v2
run (highest human score so far, 0.50) was DOM-based. This skill codifies:
"use plain DOM + CSS + `iconify-icon` for any game whose gate is UI-quality and
whose input is menu-driven — not KAPLAY."

If the next run is UI-heavy and menu-driven, **start with this skill** and do not
re-evaluate canvas frameworks.

### `pressure-forge-coupling.md`
Captures the v4 requirements clause: "At least one encounter per floor must
significantly favor or require a crafted/adapted spell." The skill lays out how to
wire each floor's constraint to a specific rune recipe that's craftable from
starting runes. Without this coupling, the forge is decorative and the ingenuity
gate scores 0 even if the forge UI is functional.

Concrete mapping used in this run:
- F1: stone_golem + warden_f1 resist direct damage; starter bolt deals 40% damage.
  Craft Ember Hemorrhage (fire+blood) or Rotbloom (nature+blood) — both apply DoT
  that bypasses direct resistance.
- F2: thornwretch + warden_f2 reflect direct damage; manaweaver has a mana-drain
  aura. Craft Rotbloom or Hexroot (shadow+nature) — DoT-only, no reflection.

## What I'd want the next run to know

1. **Trust `dom-over-kaplay.md`.** Don't retest KAPLAY unless the game design is
   fundamentally real-time.
2. **Iconify CDN dependency.** `iconify-icon` fetches SVG from Iconify's CDN at
   runtime by default. Fine over HTTP (eval is served via HTTP), but if you ever
   need offline, bundle with `addIcon` from `@iconify-json/game-icons`. This run
   did not bundle — it relies on CDN fetch at page load.
3. **Authored dungeon structure in one JSON file** (`public/data/floors.json`)
   makes iteration fast. Don't scatter it across files. 2 floors × 7-8 rooms each
   fit comfortably in one file and can be edited by hand.
4. **Combat status effects should be a small tagged union with a common
   `dmgPerTurn` and `turns` field.** I used `{ kind, dmgPerTurn, turns, sourceSpell }`
   — this is enough for burn/bleed/poison/stun/slow. Don't over-engineer it.
5. **Pressure → recipe mapping belongs in the floor JSON as `pressure_note`** so
   the player can read it in the sidebar and the reviewer can verify G2 by eye.
6. **Crafted-spell tracking.** I added `craftedSpellUsedOnFloor` to state so the
   ingenuity signal is measurable post-hoc. The next run should expose this in the
   end-screen for human review.

## Files

All inherited skills remain at their original filenames for lineage tracing:

```
game/.planning/skills/
├── CHANGELOG.md                    (this file)
├── content-pack-loading.md         (inherited, kept)
├── create-skill.md                 (inherited, kept)
├── dom-over-kaplay.md              (new — methodology core)
├── find-sprites.md                 (inherited, kept)
├── game-loop-verification.md       (inherited, kept)
├── kaplay-scene-pattern.md         (inherited, deprecated for this domain)
├── pressure-forge-coupling.md      (new — gate-critical)
├── previous-workflow.md            (inherited, kept)
└── state-composition.md            (inherited, kept)
```
