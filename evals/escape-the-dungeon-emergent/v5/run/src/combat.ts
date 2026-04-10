import type { GameState, CombatState, CombatLogEntry, SpellData, StatusEffect, EnemyData } from './types';
import { getEffectiveStats } from './state';

export function initCombat(state: GameState, enemy: EnemyData): CombatState {
  return {
    enemy: {
      ...JSON.parse(JSON.stringify(enemy)),
      statusEffects: [],
    },
    playerStatusEffects: [],
    playerShield: null,
    playerBuff: null,
    log: [{ actor: 'system', text: `${enemy.name} appears!`, type: 'info' }],
    turn: 0,
    phase: 'setup',
    autoRunning: false,
  };
}

function getLoadoutSpells(state: GameState): SpellData[] {
  return state.player.loadout.spellSlots
    .filter((id): id is string => id !== null)
    .map(id => state.player.spells.find(s => s.id === id))
    .filter((s): s is SpellData => !!s);
}

function pickPlayerAction(state: GameState, combat: CombatState): { action: 'attack' | 'spell' | 'heal'; spell?: SpellData } {
  const policy = state.player.combatPolicy;
  const stats = getEffectiveStats(state);
  const hpPct = (state.player.hp / stats.maxHp) * 100;
  const loadoutSpells = getLoadoutSpells(state);

  // Low HP: try to heal
  if (hpPct <= policy.lowHpThreshold) {
    const healSpell = loadoutSpells.find(s => s.effect.type === 'heal' && state.player.mana >= s.manaCost);
    if (healSpell) {
      return { action: 'heal', spell: healSpell };
    }
    // Try consumable heal from inventory
  }

  // Prefer DoT spells if policy says so and enemy has high direct resist or reflect
  if (policy.preferDot || combat.enemy.reflectDamage > 0.2 || combat.enemy.directResist > 0.3) {
    const dotSpell = loadoutSpells.find(s =>
      s.effect.type === 'dot' && state.player.mana >= s.manaCost
    );
    if (dotSpell) {
      return { action: 'spell', spell: dotSpell };
    }
  }

  // Use forge spells if enabled
  if (policy.useForgeSpells) {
    const forgeSpell = loadoutSpells.find(s =>
      s.isCrafted && state.player.mana >= s.manaCost
    );
    if (forgeSpell) {
      return { action: 'spell', spell: forgeSpell };
    }
  }

  // Use shield/buff spells
  const buffSpell = loadoutSpells.find(s =>
    (s.effect.type === 'shield' || s.effect.type === 'buff') &&
    state.player.mana >= s.manaCost &&
    !combat.playerShield && !combat.playerBuff
  );
  if (buffSpell) {
    return { action: 'spell', spell: buffSpell };
  }

  // Conserve mana: just attack
  if (policy.conserveMana && state.player.mana < state.player.maxMana * 0.4) {
    return { action: 'attack' };
  }

  // Use any available offensive spell
  const offensiveSpell = loadoutSpells.find(s =>
    (s.effect.type === 'direct' || s.effect.type === 'dot') &&
    state.player.mana >= s.manaCost
  );
  if (offensiveSpell) {
    return { action: 'spell', spell: offensiveSpell };
  }

  return { action: 'attack' };
}

export function executeTurn(state: GameState, combat: CombatState): void {
  combat.turn++;
  state.turnsElapsed++;
  state.hungerLevel += 0.5; // pressure: hunger increases every combat turn

  const stats = getEffectiveStats(state);
  const log = combat.log;

  // --- Player turn ---
  const decision = pickPlayerAction(state, combat);

  if (decision.action === 'heal' && decision.spell) {
    const spell = decision.spell;
    state.player.mana -= spell.manaCost;
    const healAmt = spell.effect.amount || 20;
    const actualHeal = Math.min(healAmt, stats.maxHp - state.player.hp);
    state.player.hp += actualHeal;
    log.push({ actor: 'player', text: `You cast ${spell.name}, healing ${actualHeal} HP.`, type: 'heal' });
    trackAffinity(state, spell);
  } else if (decision.action === 'spell' && decision.spell) {
    const spell = decision.spell;
    const costReduction = spell.isCrafted ? stats.craftedManaCostReduction : 0;
    const cost = Math.max(1, spell.manaCost - costReduction);
    state.player.mana -= cost;
    trackAffinity(state, spell);

    if (spell.isCrafted) {
      state.player.craftedSpellUsedOnFloor[state.currentFloorId] = true;
    }

    if (spell.effect.type === 'dot') {
      const dmg = spell.effect.damage! + Math.floor(stats.spellPower * 0.3);
      const dotResisted = Math.floor(dmg * combat.enemy.dotResist);
      const effectiveDmg = dmg - dotResisted;
      combat.enemy.statusEffects.push({
        kind: spell.effect.element || 'magic',
        dmgPerTurn: effectiveDmg,
        turns: spell.effect.turns || 3,
        sourceSpell: spell.id,
        element: spell.effect.element,
      });
      log.push({ actor: 'player', text: `You cast ${spell.name}! ${combat.enemy.name} is afflicted (${effectiveDmg}/turn for ${spell.effect.turns} turns).`, type: 'dot' });
    } else if (spell.effect.type === 'direct') {
      const rawDmg = (spell.effect.damage || 0) + Math.floor(stats.spellPower * 0.5);
      const resisted = Math.floor(rawDmg * combat.enemy.directResist);
      const dmg = Math.max(1, rawDmg - resisted - Math.floor(combat.enemy.defense * 0.3));

      // Reflect check
      if (combat.enemy.reflectDamage > 0 && !spell.effect.bypassReflect) {
        const reflected = Math.floor(dmg * combat.enemy.reflectDamage);
        let shieldAbsorb = 0;
        if (combat.playerShield) {
          shieldAbsorb = Math.min(reflected, combat.playerShield.absorb);
          combat.playerShield.absorb -= shieldAbsorb;
          if (combat.playerShield.absorb <= 0) combat.playerShield = null;
        }
        const actualReflect = reflected - shieldAbsorb;
        if (actualReflect > 0) {
          state.player.hp -= actualReflect;
          log.push({ actor: 'enemy', text: `${combat.enemy.name} reflects ${actualReflect} damage back!${shieldAbsorb > 0 ? ` (${shieldAbsorb} absorbed by shield)` : ''}`, type: 'reflect' });
        }
      }

      combat.enemy.hp -= dmg;
      log.push({ actor: 'player', text: `You cast ${spell.name} for ${dmg} damage${resisted > 0 ? ` (${resisted} resisted)` : ''}.`, type: 'damage' });
    } else if (spell.effect.type === 'buff') {
      if (spell.effect.hpCost) state.player.hp -= spell.effect.hpCost;
      if (spell.effect.manaRestore) state.player.mana = Math.min(stats.maxMana, state.player.mana + spell.effect.manaRestore);
      if (spell.effect.spellPowerBuff) {
        combat.playerBuff = { spellPower: spell.effect.spellPowerBuff, turns: spell.effect.buffTurns || 3 };
      }
      log.push({ actor: 'player', text: `You cast ${spell.name}!${spell.effect.hpCost ? ` Lost ${spell.effect.hpCost} HP.` : ''}${spell.effect.manaRestore ? ` Restored ${spell.effect.manaRestore} mana.` : ''}`, type: 'status' });
    } else if (spell.effect.type === 'shield') {
      combat.playerShield = { absorb: spell.effect.absorb || 30, turns: spell.effect.turns || 4 };
      log.push({ actor: 'player', text: `You cast ${spell.name}! Shield absorbs up to ${combat.playerShield.absorb} damage.`, type: 'status' });
    }
  } else {
    // Physical attack
    const rawDmg = stats.attack;
    const dmg = Math.max(1, rawDmg - Math.floor(combat.enemy.defense * 0.5));

    if (combat.enemy.reflectDamage > 0) {
      const reflected = Math.floor(dmg * combat.enemy.reflectDamage * 0.5); // physical reflects less
      if (reflected > 0) {
        state.player.hp -= reflected;
        log.push({ actor: 'enemy', text: `${combat.enemy.name} reflects ${reflected} damage from your attack!`, type: 'reflect' });
      }
    }

    combat.enemy.hp -= dmg;
    log.push({ actor: 'player', text: `You strike for ${dmg} damage.`, type: 'damage' });
  }

  // Check enemy death before their turn
  if (combat.enemy.hp <= 0) {
    combat.enemy.hp = 0;
    combat.phase = 'victory';
    log.push({ actor: 'system', text: `${combat.enemy.name} is defeated!`, type: 'info' });
    return;
  }

  // --- Apply DoTs on enemy ---
  const expiredEffects: number[] = [];
  for (let i = 0; i < combat.enemy.statusEffects.length; i++) {
    const eff = combat.enemy.statusEffects[i];
    combat.enemy.hp -= eff.dmgPerTurn;
    log.push({ actor: 'system', text: `${combat.enemy.name} takes ${eff.dmgPerTurn} ${eff.kind} damage (DoT).`, type: 'dot' });
    eff.turns--;
    if (eff.turns <= 0) expiredEffects.push(i);
  }
  for (let i = expiredEffects.length - 1; i >= 0; i--) {
    combat.enemy.statusEffects.splice(expiredEffects[i], 1);
  }

  if (combat.enemy.hp <= 0) {
    combat.enemy.hp = 0;
    combat.phase = 'victory';
    log.push({ actor: 'system', text: `${combat.enemy.name} is defeated!`, type: 'info' });
    return;
  }

  // --- Enemy turn ---
  // Mana drain (Manaweaver special)
  if (combat.enemy.manaDrainPerTurn) {
    const drained = Math.min(combat.enemy.manaDrainPerTurn, state.player.mana);
    state.player.mana -= drained;
    if (drained > 0) {
      log.push({ actor: 'enemy', text: `${combat.enemy.name} drains ${drained} mana!`, type: 'drain' });
    }
  }

  // Enemy attack based on traits
  const enemyTraits = combat.enemy.traits;
  const aggressionMod = 1 + (enemyTraits.aggression || 0) * 0.3;
  const rawEnemyDmg = Math.floor(combat.enemy.attack * aggressionMod);
  let actualEnemyDmg = Math.max(1, rawEnemyDmg - Math.floor(stats.defense * 0.5));

  // Shield absorb
  if (combat.playerShield) {
    const absorbed = Math.min(actualEnemyDmg, combat.playerShield.absorb);
    combat.playerShield.absorb -= absorbed;
    actualEnemyDmg -= absorbed;
    if (absorbed > 0) {
      log.push({ actor: 'system', text: `Shield absorbs ${absorbed} damage.`, type: 'status' });
    }
    if (combat.playerShield.absorb <= 0) combat.playerShield = null;
  }

  if (actualEnemyDmg > 0) {
    state.player.hp -= actualEnemyDmg;
    log.push({ actor: 'enemy', text: `${combat.enemy.name} attacks for ${actualEnemyDmg} damage.`, type: 'damage' });
  }

  // Player DoTs (from enemy abilities -- none currently but extensible)
  const expiredPlayerEffects: number[] = [];
  for (let i = 0; i < combat.playerStatusEffects.length; i++) {
    const eff = combat.playerStatusEffects[i];
    state.player.hp -= eff.dmgPerTurn;
    log.push({ actor: 'system', text: `You take ${eff.dmgPerTurn} ${eff.kind} damage.`, type: 'dot' });
    eff.turns--;
    if (eff.turns <= 0) expiredPlayerEffects.push(i);
  }
  for (let i = expiredPlayerEffects.length - 1; i >= 0; i--) {
    combat.playerStatusEffects.splice(expiredPlayerEffects[i], 1);
  }

  // Tick down shield/buff turns
  if (combat.playerShield) {
    combat.playerShield.turns--;
    if (combat.playerShield.turns <= 0) {
      combat.playerShield = null;
      log.push({ actor: 'system', text: 'Your shield fades.', type: 'status' });
    }
  }
  if (combat.playerBuff) {
    combat.playerBuff.turns--;
    if (combat.playerBuff.turns <= 0) {
      combat.playerBuff = null;
      log.push({ actor: 'system', text: 'Your buff fades.', type: 'status' });
    }
  }

  // Check player death
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    combat.phase = 'defeat';
    log.push({ actor: 'system', text: 'You have been defeated...', type: 'info' });
  }
}

function trackAffinity(state: GameState, spell: SpellData) {
  if (spell.effect.element) {
    state.player.affinities[spell.effect.element] = (state.player.affinities[spell.effect.element] || 0) + 1;
  }
  // Track spell-specific usage
  const sp = state.player.spells.find(s => s.id === spell.id);
  if (sp) {
    sp.affinityUses = (sp.affinityUses || 0) + 1;
  }
}
