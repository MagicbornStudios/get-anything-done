# Coupling pressure mechanics to the forge

## When to use

- You are designing encounters for a game whose UI-quality gate is matched by an
  ingenuity/forge gate (crafted spells must actually matter).
- Previous runs shipped "a forge" and "pressure mechanics" as two independent
  features that never touched each other — G2 passed mechanically but the human
  review score dropped because you could skip the forge.

## The pattern

Every floor's mechanical constraint must map directly to a specific crafted-spell
recipe that counters it. The counter must not be available at spawn.

```
Floor 1 → enemies resistant to DIRECT damage
        → counter: DoT or armor-pierce
        → recipe: fire+blood (Ember Hemorrhage) or nature+blood (Rotbloom)
        → both recipes only work if player visits the forge

Floor 2 → enemies REFLECT direct damage
        → counter: DoT-only (damage applied via status tick, not direct hit)
        → recipe: shadow+nature (Hexroot) bypass-shield, or Rotbloom again
        → starter Arcane Bolt is actively harmful here (reflects back)
```

Two properties make this work:

1. **Starter abilities must not clear the floor.** If the default attack or the
   starter spell can brute-force through a direct-resistant enemy, the forge is
   decorative. Give enemies enough HP and resistance that a forge visit saves 30%+
   of the player's HP.
2. **The counter must be craftable from starting runes.** The player must be able
   to solve the puzzle on floor 1 with the runes they brought in. Don't hide the
   counter behind a rune that only drops on floor 3.

## Why

v4 of this eval's requirements added an explicit "ingenuity payoff" clause: a
functional forge is not enough. At least one encounter per floor must *require*
or strongly favor a crafted spell. Without coupling the pressure mechanic to the
recipe, the forge becomes a shop the player skips.

The v4 requirement doc's floor example sequence is:

- F1: resistant to raw damage → player must apply DoT or status
- F2: reflects direct damage → player must use indirect effects
- F3: mana-drain aura → player must conserve or use physical skills

Honor this sequence in authored content. If you invent new floors, preserve the
property: each floor's boss is beatable-but-unpleasant with starters, and
obviously-winnable with the crafted counter.

## Failure modes

- **Craftable counters dominate ALL encounters.** If the forge produces a spell
  that's strictly better than starter for every fight, the floor constraint isn't
  doing anything — it just delays the power spike. Fix: give crafted spells
  specialized effects (DoT-only, pierce-only, high-cost) so they're not strictly
  better.
- **Counter requires an unknown rune.** The player can't guess which runes to
  combine if they haven't seen them. Give 3-4 runes at spawn; lock 1-2 behind
  events for replay variety.
- **Resistance is binary (immune vs normal).** Binary resistances make fights feel
  broken — either you trivialize the boss or can't damage it. Use partial
  reduction (35% through, 50% reflected) so starters still chip down.

## Related

- Depends on `find-sprites.md` — the counter recipe needs a visual payoff
  (distinct spell icon) to sell the adaptation moment.
- Supersedes nothing in the inherited set — this is a new skill capturing the v4
  ingenuity clause.
