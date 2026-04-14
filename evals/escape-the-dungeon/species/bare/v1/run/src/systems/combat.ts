import type { CombatStats, GameState, SpellData } from "../types";
import { content } from "./content";
import { awardXP } from "./gamestate";

export interface CombatEntity {
  name: string;
  stats: CombatStats & { currentHp: number; currentMana: number };
  isPlayer: boolean;
}

export interface CombatResult {
  messages: string[];
  playerDead: boolean;
  enemyDead: boolean;
  xpReward: number;
  crystalReward: number;
}

/** Create an enemy from room data. */
export function createEnemy(
  entityTypeId: string,
  archetypeId: string,
  overrideStats?: CombatStats,
  overrideName?: string
): CombatEntity {
  if (overrideStats) {
    return {
      name: overrideName ?? "Boss",
      stats: { ...overrideStats, currentHp: overrideStats.maxHp, currentMana: overrideStats.maxMana },
      isPlayer: false,
    };
  }

  const entityType = content.getEntityType(entityTypeId);
  const archetype = content.getArchetype(archetypeId);
  if (!entityType) {
    return {
      name: "Unknown",
      stats: { maxHp: 20, maxMana: 0, might: 5, agility: 5, defense: 2, power: 2, insight: 2, willpower: 2, currentHp: 20, currentMana: 0 },
      isPlayer: false,
    };
  }

  const base = { ...entityType.baseStats };
  if (archetype) {
    for (const [key, val] of Object.entries(archetype.statModifiers)) {
      const k = key as keyof CombatStats;
      if (base[k] !== undefined) {
        (base[k] as number) += val as number;
      }
    }
  }

  return {
    name: `${archetype?.name ?? ""} ${entityType.name}`.trim(),
    stats: { ...base, currentHp: base.maxHp, currentMana: base.maxMana },
    isPlayer: false,
  };
}

/** Calculate basic attack damage. */
export function calcAttackDamage(attacker: CombatEntity, defender: CombatEntity): number {
  const raw = attacker.stats.might + Math.floor(Math.random() * 6);
  const mitigated = Math.max(1, raw - defender.stats.defense);
  return mitigated;
}

/** Apply a spell in combat. Returns messages. */
export function castSpell(
  spell: SpellData,
  caster: CombatEntity,
  target: CombatEntity
): string[] {
  const msgs: string[] = [];
  if (caster.stats.currentMana < spell.manaCost) {
    msgs.push("Not enough mana!");
    return msgs;
  }

  caster.stats.currentMana -= spell.manaCost;
  msgs.push(`${caster.name} casts ${spell.name}!`);

  if (spell.damage) {
    const bonus = Math.floor(caster.stats.power * 0.5);
    const dmg = Math.max(1, spell.damage + bonus - target.stats.defense);
    target.stats.currentHp = Math.max(0, target.stats.currentHp - dmg);
    msgs.push(`${target.name} takes ${dmg} damage!`);
  }

  if (spell.healing) {
    const heal = spell.healing + Math.floor(caster.stats.power * 0.3);
    caster.stats.currentHp = Math.min(caster.stats.maxHp, caster.stats.currentHp + heal);
    msgs.push(`${caster.name} heals for ${heal} HP!`);
  }

  if (spell.defenseBoost) {
    caster.stats.defense += spell.defenseBoost;
    msgs.push(`${caster.name}'s defense increased by ${spell.defenseBoost}!`);
  }

  return msgs;
}

/** Enemy takes a turn. */
export function enemyTurn(enemy: CombatEntity, player: CombatEntity): string[] {
  const msgs: string[] = [];
  const dmg = calcAttackDamage(enemy, player);
  player.stats.currentHp = Math.max(0, player.stats.currentHp - dmg);
  msgs.push(`${enemy.name} attacks for ${dmg} damage!`);
  return msgs;
}

/** Try to run from combat. Returns true if successful. */
export function tryRun(player: CombatEntity, enemy: CombatEntity): boolean {
  const chance = 0.4 + (player.stats.agility - enemy.stats.agility) * 0.05;
  return Math.random() < Math.min(0.9, Math.max(0.1, chance));
}

/** Compute rewards for defeating an enemy. */
export function computeRewards(enemy: CombatEntity, state: GameState): CombatResult {
  const xp = Math.floor(enemy.stats.maxHp * 0.8);
  const crystals = Math.floor(enemy.stats.maxHp * 0.3);
  const msgs = awardXP(state, xp);
  state.player.crystals += crystals;
  msgs.push(`Found ${crystals} mana crystals!`);
  return {
    messages: msgs,
    playerDead: false,
    enemyDead: true,
    xpReward: xp,
    crystalReward: crystals,
  };
}
