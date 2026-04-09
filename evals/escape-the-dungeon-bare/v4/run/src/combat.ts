import type { EnemyType, Resistance } from "./data/entities";
import type { PlayerSpell } from "./data/spells";
import type { GameState, StatusEffect } from "./state";
import type { SpellElement } from "./data/runes";

export interface CombatEnemy {
  template: EnemyType;
  currentHp: number;
  maxHp: number;
  statusEffects: StatusEffect[];
}

export interface CombatAction {
  type: "attack" | "spell" | "item" | "flee";
  spellId?: string;
  itemId?: string;
}

export interface CombatResult {
  messages: LogEntry[];
  playerDead: boolean;
  enemyDead: boolean;
  fled: boolean;
}

export interface LogEntry {
  text: string;
  type: "damage" | "heal" | "spell" | "info" | "resist";
}

function getResistance(resistances: Resistance[], element: SpellElement | "physical"): number {
  const r = resistances.find((res) => res.element === element);
  return r ? r.value : 0;
}

function applyResistance(baseDamage: number, resistance: number): number {
  // resistance > 0 means resistant (takes less), < 0 means weak (takes more)
  return Math.max(1, Math.round(baseDamage * (1 - resistance)));
}

// Calculate physical attack damage
function calcPhysicalDamage(might: number, defense: number): number {
  const base = might * 2;
  const reduced = Math.max(1, base - defense);
  // Add small variance
  return Math.round(reduced * (0.9 + Math.random() * 0.2));
}

export function createCombatEnemy(template: EnemyType): CombatEnemy {
  return {
    template,
    currentHp: template.stats.currentHp,
    maxHp: template.stats.maxHp,
    statusEffects: [],
  };
}

// Process a player turn
export function processPlayerAction(
  state: GameState,
  enemy: CombatEnemy,
  action: CombatAction
): CombatResult {
  const messages: LogEntry[] = [];
  let playerDead = false;
  let enemyDead = false;
  let fled = false;

  state.combatTurn++;

  // === PLAYER ACTION ===
  if (action.type === "attack") {
    const baseDmg = calcPhysicalDamage(state.stats.might, enemy.template.stats.defense);
    const resistance = getResistance(enemy.template.resistances, "physical");
    const finalDmg = applyResistance(baseDmg, resistance);
    enemy.currentHp -= finalDmg;

    if (resistance > 0.3) {
      messages.push({ text: `You strike for ${finalDmg} physical damage. The enemy's armor absorbs much of the blow!`, type: "resist" });
    } else if (resistance < -0.2) {
      messages.push({ text: `You strike for ${finalDmg} physical damage! Effective hit!`, type: "damage" });
    } else {
      messages.push({ text: `You strike for ${finalDmg} physical damage.`, type: "damage" });
    }

    // Reflector behavior
    if (enemy.template.behavior === "reflector") {
      const reflected = Math.round(finalDmg * 0.3);
      state.stats.currentHp -= reflected;
      messages.push({ text: `The enemy reflects ${reflected} damage back at you!`, type: "resist" });
    }
  } else if (action.type === "spell") {
    const spell = state.spells.find((s) => s.id === action.spellId);
    if (spell && state.stats.currentMana >= spell.manaCost) {
      state.stats.currentMana -= spell.manaCost;
      messages.push({ text: `You cast ${spell.name}! (-${spell.manaCost} mana)`, type: "spell" });

      for (const effect of spell.effects) {
        if (effect.type === "damage") {
          const resistance = getResistance(enemy.template.resistances, effect.element);
          const basePower = effect.power + Math.floor(state.stats.power * 0.5);
          const finalDmg = applyResistance(basePower, resistance);
          enemy.currentHp -= finalDmg;

          if (resistance > 0.3) {
            messages.push({ text: `${effect.description}: ${finalDmg} damage (resisted!)`, type: "resist" });
          } else if (resistance < -0.2) {
            messages.push({ text: `${effect.description}: ${finalDmg} damage (super effective!)`, type: "damage" });
          } else {
            messages.push({ text: `${effect.description}: ${finalDmg} damage`, type: "damage" });
          }

          // Reflector: only reflects 15% of spell damage
          if (enemy.template.behavior === "reflector") {
            const reflected = Math.round(finalDmg * 0.15);
            state.stats.currentHp -= reflected;
            messages.push({ text: `Reflected ${reflected} damage back!`, type: "resist" });
          }
        } else if (effect.type === "dot") {
          enemy.statusEffects.push({
            name: `${effect.element} DoT`,
            type: "dot",
            element: effect.element,
            power: effect.power + Math.floor(state.stats.power * 0.3),
            turnsRemaining: effect.duration ?? 3,
          });
          messages.push({ text: `${effect.description} applied!`, type: "spell" });
        } else if (effect.type === "heal") {
          const healAmount = effect.power;
          state.stats.currentHp = Math.min(state.stats.maxHp, state.stats.currentHp + healAmount);
          messages.push({ text: `Healed ${healAmount} HP!`, type: "heal" });
        } else if (effect.type === "debuff") {
          enemy.statusEffects.push({
            name: `${effect.element} debuff`,
            type: "debuff_defense",
            element: effect.element,
            power: effect.power,
            turnsRemaining: effect.duration ?? 2,
          });
          messages.push({ text: `Enemy's defense reduced by ${effect.power}!`, type: "spell" });
        }
      }

      // Boost rune affinity for crafted spells
      if (spell.crafted && spell.runeIds) {
        for (const runeId of spell.runeIds) {
          state.runeAffinity[runeId] = (state.runeAffinity[runeId] ?? 0) + 0.1;
        }
      }
    } else {
      messages.push({ text: "Not enough mana!", type: "info" });
    }
  } else if (action.type === "item") {
    // Item usage handled externally before calling this
    messages.push({ text: "Used item.", type: "info" });
  } else if (action.type === "flee") {
    const fleeChance = state.stats.agility / (state.stats.agility + enemy.template.stats.agility);
    if (Math.random() < fleeChance) {
      fled = true;
      messages.push({ text: "You successfully fled!", type: "info" });
      return { messages, playerDead, enemyDead, fled };
    } else {
      messages.push({ text: "Failed to flee!", type: "info" });
    }
  }

  // Check enemy death
  if (enemy.currentHp <= 0) {
    enemyDead = true;
    enemy.currentHp = 0;
    messages.push({ text: `${enemy.template.name} defeated!`, type: "info" });
    return { messages, playerDead, enemyDead, fled };
  }

  // === PROCESS DOTs ON ENEMY ===
  const activeDots = enemy.statusEffects.filter((s) => s.type === "dot");
  for (const dot of activeDots) {
    const resistance = getResistance(enemy.template.resistances, dot.element as SpellElement);
    const dotDmg = applyResistance(dot.power, resistance);
    enemy.currentHp -= dotDmg;
    messages.push({ text: `${dot.name} deals ${dotDmg} damage.`, type: "damage" });
    dot.turnsRemaining--;
  }

  // Remove expired status effects
  enemy.statusEffects = enemy.statusEffects.filter((s) => s.turnsRemaining > 0);

  // Check enemy death again after DoTs
  if (enemy.currentHp <= 0) {
    enemyDead = true;
    enemy.currentHp = 0;
    messages.push({ text: `${enemy.template.name} succumbed to damage over time!`, type: "info" });
    return { messages, playerDead, enemyDead, fled };
  }

  // === ENEMY ACTION ===
  const enemyDmg = processEnemyTurn(state, enemy, messages);

  // Check player death
  if (state.stats.currentHp <= 0) {
    playerDead = true;
    state.stats.currentHp = 0;
    messages.push({ text: "You have been defeated...", type: "info" });
  }

  // Process player DoTs
  const playerDots = state.statusEffects.filter((s) => s.type === "dot");
  for (const dot of playerDots) {
    state.stats.currentHp -= dot.power;
    messages.push({ text: `You take ${dot.power} ${dot.name} damage.`, type: "damage" });
    dot.turnsRemaining--;
  }
  state.statusEffects = state.statusEffects.filter((s) => s.turnsRemaining > 0);

  if (state.stats.currentHp <= 0) {
    playerDead = true;
    state.stats.currentHp = 0;
  }

  return { messages, playerDead, enemyDead, fled };
}

function processEnemyTurn(state: GameState, enemy: CombatEnemy, messages: LogEntry[]): void {
  const template = enemy.template;

  // Calculate effective defense (accounting for debuffs)
  const defDebuffs = enemy.statusEffects.filter((s) => s.type === "debuff_defense");
  const defReduction = defDebuffs.reduce((sum, d) => sum + d.power, 0);

  switch (template.behavior) {
    case "basic": {
      const dmg = Math.max(1, calcPhysicalDamage(template.stats.might, state.stats.defense));
      state.stats.currentHp -= dmg;
      messages.push({ text: `${template.name} attacks for ${dmg} damage!`, type: "damage" });
      break;
    }
    case "defensive": {
      if (Math.random() < 0.3) {
        messages.push({ text: `${template.name} raises its guard!`, type: "info" });
        // Defensive stance - reduced damage next turn
      } else {
        const dmg = Math.max(1, calcPhysicalDamage(template.stats.might, state.stats.defense));
        state.stats.currentHp -= dmg;
        messages.push({ text: `${template.name} attacks for ${dmg} damage!`, type: "damage" });
      }
      break;
    }
    case "spellcaster": {
      const elements: SpellElement[] = ["fire", "ice", "lightning", "arcane"];
      const elem = elements[Math.floor(Math.random() * elements.length)];
      const spellDmg = Math.max(1, template.stats.power * 2 - Math.floor(state.stats.willpower * 0.5));
      state.stats.currentHp -= spellDmg;
      messages.push({ text: `${template.name} casts a ${elem} spell for ${spellDmg} damage!`, type: "spell" });
      break;
    }
    case "berserker": {
      const hpPercent = enemy.currentHp / enemy.maxHp;
      const rageMultiplier = hpPercent < 0.3 ? 2.0 : hpPercent < 0.5 ? 1.5 : 1.0;
      const baseDmg = calcPhysicalDamage(template.stats.might, state.stats.defense);
      const dmg = Math.max(1, Math.round(baseDmg * rageMultiplier));
      state.stats.currentHp -= dmg;
      if (rageMultiplier > 1) {
        messages.push({ text: `${template.name} rages and hits for ${dmg} damage!`, type: "damage" });
      } else {
        messages.push({ text: `${template.name} attacks for ${dmg} damage!`, type: "damage" });
      }
      break;
    }
    case "regenerator": {
      const healAmt = Math.round(enemy.maxHp * 0.08);
      enemy.currentHp = Math.min(enemy.maxHp, enemy.currentHp + healAmt);
      messages.push({ text: `${template.name} regenerates ${healAmt} HP!`, type: "heal" });
      const dmg = Math.max(1, calcPhysicalDamage(template.stats.might, state.stats.defense));
      state.stats.currentHp -= dmg;
      messages.push({ text: `${template.name} attacks for ${dmg} damage!`, type: "damage" });
      break;
    }
    case "reflector": {
      // Reflectors also do a normal attack
      const dmg = Math.max(1, calcPhysicalDamage(template.stats.might, state.stats.defense));
      state.stats.currentHp -= dmg;
      messages.push({ text: `${template.name} strikes for ${dmg} damage!`, type: "damage" });
      break;
    }
    case "mana_drain": {
      const drainAmt = Math.min(state.stats.currentMana, 8);
      state.stats.currentMana -= drainAmt;
      messages.push({ text: `${template.name} drains ${drainAmt} mana!`, type: "spell" });
      const dmg = Math.max(1, calcPhysicalDamage(template.stats.might, state.stats.defense));
      state.stats.currentHp -= dmg;
      messages.push({ text: `${template.name} attacks for ${dmg} damage!`, type: "damage" });
      break;
    }
  }
}
