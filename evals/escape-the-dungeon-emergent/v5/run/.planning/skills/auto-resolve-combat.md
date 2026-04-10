# Auto-resolve Combat (Unicorn Overlord Pattern)

## When to use
- The game requires combat but is NOT a real-time action game
- Requirements specify "auto-resolve" or "configure loadout + policies before encounter"
- Player should feel like a strategist/commander, not a button-masher

## The pattern

Split combat into two phases: SETUP and EXECUTION.

**Setup phase:** Player configures before combat starts:
1. Spell loadout (4 slots from known spells)
2. Action policies (toggles: prefer DoT, use crafted spells, conserve mana)
3. Heal threshold (% HP at which the AI will attempt healing)

**Execution phase:** Combat auto-resolves with a visible log:
- Each turn, an AI picks the player's action based on policies + enemy state
- Enemy turn runs based on enemy traits (aggression, cunning drive behavior)
- Player can PAUSE at any time to adjust loadout/policies, then RESUME
- Resolution depends on build quality (gear + spells + policies), not reflexes

```typescript
// The policy-driven decision function
function pickPlayerAction(state, combat): { action, spell? } {
  const policy = state.player.combatPolicy;
  const hpPct = state.player.hp / maxHp * 100;

  // Priority chain:
  // 1. Heal if low HP
  if (hpPct <= policy.lowHpThreshold) { /* find heal spell */ }
  // 2. Prefer DoT if policy says so OR enemy reflects/resists direct
  if (policy.preferDot || enemy.reflectDamage > threshold) { /* find DoT */ }
  // 3. Use forge spells if enabled
  if (policy.useForgeSpells) { /* find crafted spell */ }
  // 4. Buff/shield if none active
  // 5. Physical attack as fallback
}
```

**Timer-driven auto-play:**
```typescript
function runAutoCombat() {
  if (!combat.autoRunning || combat.phase !== 'running') return;
  executeTurn(state, combat);
  render();
  if (combat.phase === 'running') {
    combatTimer = setTimeout(() => runAutoCombat(), 800);
  }
}
```

## Why

The Unicorn Overlord style separates strategic thinking (setup) from execution
(auto-resolve). This makes combat about preparation and build quality rather
than clicking the right button at the right time. It also makes the forge/loadout
systems load-bearing -- the player's combat performance depends directly on what
they crafted and equipped.

This pattern also makes the pressure-forge coupling (see pressure-forge-coupling.md)
more visible: if the player enters combat without the right DoT spell against a
reflecting boss, the auto-resolve demonstrates the penalty immediately through
reflected damage in the log.

## Failure modes

- **AI always picks the same action.** If the priority chain is too simple, combat
  feels robotic. Add enemy-state-awareness (e.g., prefer DoT when enemy has high
  direct resist, prefer shield when enemy has high attack).
- **No pause button.** Without pause, the player can't adjust mid-combat. This
  removes the "commander" feeling -- they just watch helplessly.
- **Timer too fast or too slow.** 800ms per turn is a good default. Faster feels
  rushed, slower feels boring. Let the player adjust if possible.
- **Log not scrolling.** Auto-scroll the combat log to the bottom after each turn
  so the player always sees the latest action.

## Related

- Depends on `pressure-forge-coupling.md` (makes forge spells load-bearing in combat)
- Depends on `dom-over-kaplay.md` (DOM rendering makes the log + pause trivial)
