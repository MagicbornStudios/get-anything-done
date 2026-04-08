# Escape the Dungeon - Build Workflow

## Approach: Plan-Do-Check-Act (PDCA)
Each phase: plan what to build, build it, verify it works, update tracking.

## Phases & Status

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Project scaffold + title screen | DONE | Vite + TS, DOM-based UI |
| 2 | Room navigation with styled UI | DONE | Graph rooms, button nav, room colors |
| 3 | Combat with visual HP bars | DONE | Turn-based, Fight/Spells/Bag/Run |
| 4 | Rune forge + spell crafting | DONE | 7 runes, 7 combos, forge UI |
| 5 | Dialogue + NPC portraits | DONE | Branching choices, SVG portraits |
| 6 | HUD + overlay menus | DONE | HP/mana bars, Bag+Spellbook+Stats+Map |
| 7 | Content packs + save/load | DONE | JSON-driven data, localStorage |
| 8 | Polish + production build | IN PROGRESS | Testing, review |

## Architecture Decisions
- KAPLAY for game framework (required by spec)
- Scene-based architecture: title, room, combat, dialogue, forge scenes
- HTML DOM overlay for UI (avoids KAPLAY styled text bugs)
- Single object arg for k.go() scene transitions
- All buttons use area() component for click handling

## Known Bug Avoidance
- KAPLAY buttons: ALWAYS add area() component
- Scene transitions: k.go("scene", { data }) - single object arg
- NO [tag] styled text with dynamic content
- ALWAYS add scene transition back to room after combat/dialogue

## Reusable Patterns
(Will be added as discovered during implementation)
