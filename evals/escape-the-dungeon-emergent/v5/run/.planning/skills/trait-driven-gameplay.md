# Trait-driven Gameplay

## When to use
- Requirements specify visible numeric trait values that shift from player actions
- Traits need to affect NPC dialogue options, enemy AI, or game outcomes
- You need moral choices with measurable consequences

## The pattern

Store traits as floating-point values (0.0 to 1.0) on the player state:

```typescript
player.traits = {
  aggression: 0.3,
  compassion: 0.5,
  cunning: 0.3,
};
```

**Trait shifts** come from:
1. Dialogue choices (each branch has `traitShift: { compassion: 0.1 }`)
2. Combat actions (using aggressive spells could shift aggression up)
3. Moral decisions (sparing vs destroying, helping vs exploiting)

**Traits affect gameplay:**
- Enemy AI uses `aggression` trait to scale attack damage: `rawDmg * (1 + aggression * 0.3)`
- NPC dialogue shows different options or responses based on trait thresholds
- End-game summary displays trait values as part of the run statistics

**UI display:** Show trait bars in a sidebar panel with numeric values visible:

```html
<div class="trait-row">
  <span>aggression</span>
  <div class="trait-bar-bg">
    <div class="trait-bar-fill" style="width:${val * 100}%"></div>
  </div>
  <span class="trait-value">${val.toFixed(2)}</span>
</div>
```

## Why

Traits create a feedback loop between choices and consequences. When the player
sees their aggression go from 0.3 to 0.5 after a violent choice, and then sees
enemies hit harder in the next combat (because enemy AI uses the player's
aggression to justify more aggressive behavior), the game feels reactive.

The numeric display is critical -- hidden traits feel opaque and arbitrary.
Visible numbers let the player reason about their build.

## Failure modes

- **Traits displayed but never used.** If traits don't affect anything, they're
  decoration. Wire them to at least 2 gameplay systems (combat + dialogue).
- **Trait shifts too small to notice.** A shift of 0.01 is meaningless. Use 0.05-0.15
  per choice so the player sees movement within a single floor.
- **Binary outcomes.** Don't gate content on "compassion > 0.5 vs <= 0.5". Use
  the trait as a multiplier/modifier so all values produce different-but-valid
  results.

## Related

- Works with `auto-resolve-combat.md` -- enemy traits drive their AI decisions
- Enhances `pressure-forge-coupling.md` -- trait shifts from dialogue can hint
  at the right forge strategy for the floor
