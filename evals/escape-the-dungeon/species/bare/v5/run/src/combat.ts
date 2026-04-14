import type {
  EnemyInstance,
  Player,
  Spell,
  Skill,
  StatusEffect,
  DamageType,
} from "./types";
import { findSpell } from "./state";
import { SKILLS } from "./content";

export type CombatLog = (line: string, cls?: string) => void;

export type CombatResult =
  | { kind: "ongoing" }
  | { kind: "victory"; xp: number; crystals: number }
  | { kind: "defeat" };

function resistMultiplier(enemy: EnemyInstance, type: DamageType): number {
  const r = enemy.resistances as Record<string, number | undefined>;
  const m = r[type];
  return m === undefined ? 1.0 : m;
}

function describeMultiplier(m: number): string {
  if (m === 0) return "IMMUNE";
  if (m <= 0.35) return "highly resisted";
  if (m < 0.9) return "resisted";
  if (m >= 1.4) return "WEAK";
  if (m >= 1.1) return "hit hard";
  return "";
}

function applyEmpower(player: Player): number {
  let mult = 1;
  for (const e of player.activeEffects) {
    if (e.kind === "empower") mult *= e.magnitude;
  }
  return mult;
}

export function playerUseSpell(
  player: Player,
  enemies: EnemyInstance[],
  targetIdx: number,
  spellId: string,
  log: CombatLog,
): void {
  const spell = findSpell(spellId);
  if (!spell) return;
  if (player.combatStats.currentMana < spell.manaCost) {
    log("Not enough mana.", "info");
    return;
  }
  if (spell.crystalCost && player.crystals < spell.crystalCost) {
    log("Not enough crystals.", "info");
    return;
  }
  player.combatStats.currentMana -= spell.manaCost;
  if (spell.crystalCost) player.crystals -= spell.crystalCost;

  // affinity gain
  for (const r of spell.runes) {
    player.runeAffinity[r] = (player.runeAffinity[r] ?? 0) + 1;
  }

  log(`You cast ${spell.name}.`, "info");

  if (spell.target === "self") {
    if (spell.selfHeal) {
      const heal = Math.min(spell.selfHeal, player.combatStats.maxHp - player.combatStats.currentHp);
      player.combatStats.currentHp += heal;
      log(`You heal ${heal} HP.`, "heal");
    }
    if (spell.effects) {
      for (const e of spell.effects) {
        player.activeEffects.push({ ...e });
        log(`${spell.name} grants ${e.kind}.`, "info");
      }
    }
    // Antivenin cleanses
    if (spell.id === "antivenin") {
      player.activeEffects = player.activeEffects.filter(e => e.kind !== "dot" && e.kind !== "slow");
      log("Toxins purged.", "heal");
    }
    return;
  }

  const target = enemies[targetIdx];
  if (!target || target.combatStats.currentHp <= 0) return;

  const empowerMult = applyEmpower(player);
  const scaled = (spell.power + player.combatStats.power) * empowerMult;
  const resist = resistMultiplier(target, spell.damageType);
  const dmg = Math.max(0, Math.round(scaled * resist));

  if (dmg > 0) {
    target.combatStats.currentHp -= dmg;
    const flavor = describeMultiplier(resist);
    log(`${target.name} takes ${dmg} ${spell.damageType} damage${flavor ? " — " + flavor : ""}.`, "dmg");
    if (target.ai === "reflect" && target.reflectPct) {
      const refl = Math.max(1, Math.round(dmg * target.reflectPct));
      player.combatStats.currentHp -= refl;
      log(`${target.name}'s mirrors reflect ${refl} damage back at you!`, "resist");
    }
  } else {
    log(`${target.name} is IMMUNE to ${spell.damageType}!`, "resist");
  }

  if (spell.effects) {
    for (const e of spell.effects) {
      if (e.kind === "dot" || e.kind === "slow" || e.kind === "burn") {
        // DoTs resisted check: fully immune => still apply with lowered magnitude? We'll just halve magnitude for immunity/resist of the DoT type
        const et = e.damageType ?? spell.damageType;
        const rm = resistMultiplier(target, et);
        if (rm > 0) {
          target.activeEffects.push({ ...e, magnitude: Math.max(1, Math.round(e.magnitude * rm)) });
          log(`${target.name} is afflicted with ${e.kind}.`, "info");
        } else {
          log(`${target.name} shrugs off the ${e.kind}.`, "resist");
        }
      }
    }
  }

  // decay empower usage
  player.activeEffects = player.activeEffects
    .map(e => e.kind === "empower" ? { ...e, turns: e.turns - 1 } : e)
    .filter(e => e.turns > 0);
}

export function playerUseSkill(
  player: Player,
  enemies: EnemyInstance[],
  targetIdx: number,
  skillId: string,
  overcharge: boolean,
  log: CombatLog,
): void {
  const skill = SKILLS.find(s => s.id === skillId);
  if (!skill) return;
  if (overcharge && skill.crystalOvercharge) {
    if (player.crystals < skill.crystalOvercharge.crystalCost) {
      log("Not enough crystals to overcharge.", "info");
      return;
    }
    player.crystals -= skill.crystalOvercharge.crystalCost;
  }

  const target = enemies[targetIdx];
  if (!target || target.combatStats.currentHp <= 0) return;

  const empowerMult = applyEmpower(player);
  let basePower = skill.power + Math.round(player.combatStats.might / 2);
  if (overcharge && skill.crystalOvercharge) basePower += skill.crystalOvercharge.bonus;

  const resist = resistMultiplier(target, skill.damageType);
  const dmg = Math.max(0, Math.round((basePower - target.combatStats.defense / 2) * resist * empowerMult));

  log(`You ${skill.name.toLowerCase()} ${target.name}.`, "info");
  if (dmg > 0) {
    target.combatStats.currentHp -= dmg;
    const flavor = describeMultiplier(resist);
    log(`${target.name} takes ${dmg} ${skill.damageType} damage${flavor ? " — " + flavor : ""}.`, "dmg");
    if (target.ai === "reflect" && target.reflectPct) {
      const refl = Math.max(1, Math.round(dmg * target.reflectPct));
      player.combatStats.currentHp -= refl;
      log(`${target.name}'s mirrors reflect ${refl} damage back at you!`, "resist");
    }
  } else {
    log(`${target.name} takes no damage!`, "resist");
  }

  if (overcharge && skill.crystalOvercharge?.addEffect) {
    target.activeEffects.push({ ...skill.crystalOvercharge.addEffect });
    log(`${target.name} bleeds from the overcharged strike.`, "info");
  }

  player.activeEffects = player.activeEffects
    .map(e => e.kind === "empower" ? { ...e, turns: e.turns - 1 } : e)
    .filter(e => e.turns > 0);
}

export function playerTryFlee(player: Player, enemies: EnemyInstance[], log: CombatLog): boolean {
  const avgAgi = enemies.reduce((s, e) => s + e.combatStats.agility, 0) / enemies.length;
  const chance = 0.4 + (player.combatStats.agility - avgAgi) * 0.1;
  if (Math.random() < chance) {
    log("You slip away!", "info");
    return true;
  }
  log("You fail to escape!", "resist");
  return false;
}

export function enemyTurn(
  player: Player,
  enemies: EnemyInstance[],
  log: CombatLog,
): void {
  for (const enemy of enemies) {
    if (enemy.combatStats.currentHp <= 0) continue;

    // apply DoTs to enemy
    let dotTotal = 0;
    for (const e of enemy.activeEffects) {
      if (e.kind === "dot" || e.kind === "burn") {
        dotTotal += e.magnitude;
      }
    }
    if (dotTotal > 0) {
      enemy.combatStats.currentHp -= dotTotal;
      log(`${enemy.name} suffers ${dotTotal} DoT damage.`, "dmg");
      if (enemy.combatStats.currentHp <= 0) continue;
    }

    // slow prevents attack
    const slowed = enemy.activeEffects.some(e => e.kind === "slow");
    if (slowed) {
      log(`${enemy.name} is slowed and can't act.`, "info");
    } else {
      // basic attack
      const dmg = Math.max(1, enemy.combatStats.might - Math.floor(player.combatStats.defense / 2));
      player.combatStats.currentHp -= dmg;
      log(`${enemy.name} strikes you for ${dmg} damage.`, "dmg");
    }

    // tick down enemy effects
    enemy.activeEffects = enemy.activeEffects
      .map(e => ({ ...e, turns: e.turns - 1 }))
      .filter(e => e.turns > 0);
  }
}

export function checkCombatResult(player: Player, enemies: EnemyInstance[]): CombatResult {
  if (player.combatStats.currentHp <= 0) return { kind: "defeat" };
  const allDead = enemies.every(e => e.combatStats.currentHp <= 0);
  if (allDead) {
    const xp = enemies.reduce((s, e) => s + e.xpReward, 0);
    const crystals = enemies.reduce((s, e) => s + e.crystalReward, 0);
    return { kind: "victory", xp, crystals };
  }
  return { kind: "ongoing" };
}

export function applyRewards(player: Player, xp: number, crystals: number): void {
  player.xp += xp;
  player.crystals += crystals;
  // level-up
  while (player.xp >= player.level * 25) {
    player.xp -= player.level * 25;
    player.level += 1;
    player.combatStats.maxHp += 5;
    player.combatStats.currentHp = player.combatStats.maxHp;
    player.combatStats.maxMana += 2;
    player.combatStats.currentMana = player.combatStats.maxMana;
    player.combatStats.might += 1;
    player.combatStats.power += 1;
  }
}
