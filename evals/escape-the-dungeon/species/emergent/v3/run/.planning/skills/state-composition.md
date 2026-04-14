# Skill: State Composition

**Source:** escape-the-dungeon-bare v1
**Category:** Code pattern
**Version:** 2

## Pattern

Entity stats = entityType.baseStats + archetype.statModifiers.
Loop over modifier keys, add to base. Initialize currentHp/currentMana from maxHp/maxMana.

## When to use

Creating player or NPC entities from content pack data.

## Failure modes

- **NaN stats** — If archetype modifiers reference a key that doesn't exist in baseStats,
  you get `undefined + number = NaN`. Always default missing keys to 0.

- **HP/Mana not initialized** — If you compute maxHp but forget to set currentHp = maxHp
  on entity creation, the player starts with 0 HP and dies immediately.

- **Stat changes not reflected in UI** — If you modify stats in the state object but don't
  re-render the HUD, the display is stale. Use the re-render pattern from kaplay-scene-pattern.

## Known fixes

```typescript
const stats = { ...baseStats };
for (const [key, mod] of Object.entries(archetype.statModifiers)) {
  stats[key] = (stats[key] || 0) + mod;
}
stats.currentHp = stats.maxHp;
stats.currentMana = stats.maxMana;
```
