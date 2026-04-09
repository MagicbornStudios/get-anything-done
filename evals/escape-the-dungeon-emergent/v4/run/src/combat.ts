import type { CombatState, EnemyDef, EnemyInstance, GameState, Spell, StatusEffect } from "./types";

export function makeEnemy(defKey: string, def: EnemyDef, elite = false): EnemyInstance {
  const mult = elite ? 1.35 : 1;
  return {
    def: { ...def, maxHp: Math.round(def.maxHp * mult), might: Math.round(def.might * mult) },
    defKey,
    currentHp: Math.round(def.maxHp * mult),
    statuses: [],
  };
}

export function startCombat(state: GameState, enemy: EnemyInstance, returnTo: string) {
  state.combat = {
    enemy,
    returnTo,
    log: [
      { kind: "system", text: `${enemy.def.name} blocks the way.` },
      ...(enemy.def.note ? [{ kind: "system" as const, text: `! ${enemy.def.note}` }] : []),
    ],
    turn: "player",
    ended: false,
    playerDamagedTick: 0,
    enemyDamagedTick: 0,
    usedCraftedSpellThisFight: false,
  };
  state.view = "combat";
}

function logPush(c: CombatState, entry: { kind: "dmg" | "heal" | "spell" | "system"; text: string }) {
  c.log.unshift(entry);
  if (c.log.length > 40) c.log.length = 40;
}

export function playerAttack(state: GameState): void {
  const c = state.combat!;
  if (c.ended || c.turn !== "player") return;
  const p = state.player;
  const raw = Math.max(1, p.might - c.enemy.def.defense);
  let dmg = raw;
  // reflectors punish direct damage heavily
  if (c.enemy.def.reflects === "direct") {
    const reflected = Math.round(dmg * 0.6);
    p.currentHp -= reflected;
    logPush(c, { kind: "dmg", text: `Thorns lash back for ${reflected}.` });
    c.playerDamagedTick = Date.now();
  }
  // resistances soak direct
  if (c.enemy.def.resistances.includes("direct")) {
    dmg = Math.max(1, Math.round(dmg * 0.35));
  }
  c.enemy.currentHp -= dmg;
  logPush(c, { kind: "dmg", text: `You strike ${c.enemy.def.name} for ${dmg}.` });
  c.enemyDamagedTick = Date.now();
  endPlayerTurn(state);
}

export function playerCastSpell(state: GameState, spell: Spell): { ok: boolean; reason?: string } {
  const c = state.combat!;
  if (c.ended || c.turn !== "player") return { ok: false, reason: "Not your turn" };
  const p = state.player;
  if (p.currentMana < spell.cost) return { ok: false, reason: "Not enough mana" };
  p.currentMana -= spell.cost;
  if (spell.crafted) c.usedCraftedSpellThisFight = true;

  const eff = spell.effect;
  logPush(c, { kind: "spell", text: `You cast ${spell.name}.` });

  let directDmg = eff.damage;
  if (c.enemy.def.resistances.includes("direct") && !eff.armorPierce && eff.type === "direct") {
    directDmg = Math.max(1, Math.round(directDmg * 0.4));
    logPush(c, { kind: "system", text: `${c.enemy.def.name}'s hide blunts the blast.` });
  }
  // reflectors reflect direct-type hits but NOT DoT application damage
  if (c.enemy.def.reflects === "direct" && eff.type === "direct") {
    const reflected = Math.round(directDmg * 0.5);
    p.currentHp -= reflected;
    logPush(c, { kind: "dmg", text: `Thorns lash back for ${reflected}.` });
    c.playerDamagedTick = Date.now();
  }
  c.enemy.currentHp -= directDmg;
  logPush(c, { kind: "dmg", text: `${spell.name} hits for ${directDmg}.` });
  c.enemyDamagedTick = Date.now();

  if (eff.type === "dot" && eff.dotDamage && eff.duration) {
    const kind: StatusEffect["kind"] = eff.element === "fire" ? "burn" : eff.element === "nature" ? "poison" : "bleed";
    c.enemy.statuses.push({
      kind,
      dmgPerTurn: eff.dotDamage,
      turns: eff.duration,
      sourceSpell: spell.id,
    });
    logPush(c, { kind: "spell", text: `${c.enemy.def.name} suffers ${kind} (${eff.dotDamage}/turn, ${eff.duration}t).` });
  }
  if (eff.type === "stun" && eff.stunTurns) {
    c.enemy.statuses.push({ kind: "stun", dmgPerTurn: 0, turns: eff.stunTurns, sourceSpell: spell.id });
    logPush(c, { kind: "spell", text: `${c.enemy.def.name} is stunned for ${eff.stunTurns}t.` });
  }
  if (eff.type === "drain" && eff.heal) {
    p.currentHp = Math.min(p.maxHp, p.currentHp + eff.heal);
    logPush(c, { kind: "heal", text: `You drain ${eff.heal} HP.` });
  }
  if (eff.manaReturn) {
    p.currentMana = Math.min(p.maxMana, p.currentMana + eff.manaReturn);
    logPush(c, { kind: "heal", text: `${spell.name} refunds ${eff.manaReturn} mana.` });
  }
  // Affinity gain
  if (spell.inputs) {
    for (const r of spell.inputs) p.runeAffinity[r] = (p.runeAffinity[r] || 0) + 1;
  }
  endPlayerTurn(state);
  return { ok: true };
}

export function playerFlee(state: GameState): boolean {
  const c = state.combat!;
  const roll = Math.random() + state.player.agility * 0.05;
  if (roll > 0.7) {
    logPush(c, { kind: "system", text: "You slip away." });
    c.ended = true;
    c.outcome = "flee";
    return true;
  }
  logPush(c, { kind: "system", text: "You fail to escape!" });
  endPlayerTurn(state);
  return false;
}

export function playerUsePotion(state: GameState): boolean {
  const c = state.combat!;
  const p = state.player;
  if (p.crystals < 3) {
    logPush(c, { kind: "system", text: "Not enough crystals for a potion." });
    return false;
  }
  p.crystals -= 3;
  const heal = 14;
  p.currentHp = Math.min(p.maxHp, p.currentHp + heal);
  logPush(c, { kind: "heal", text: `You quaff a potion (+${heal} HP).` });
  endPlayerTurn(state);
  return true;
}

function endPlayerTurn(state: GameState) {
  const c = state.combat!;
  tickEnemyStatuses(state);
  if (c.enemy.currentHp <= 0) {
    resolveWin(state);
    return;
  }
  c.turn = "enemy";
  setTimeout(() => enemyTurn(state), 650);
}

function tickEnemyStatuses(state: GameState) {
  const c = state.combat!;
  const remaining: StatusEffect[] = [];
  for (const s of c.enemy.statuses) {
    if (s.dmgPerTurn > 0) {
      c.enemy.currentHp -= s.dmgPerTurn;
      logPush(c, { kind: "dmg", text: `${s.kind} deals ${s.dmgPerTurn} to ${c.enemy.def.name}.` });
    }
    s.turns -= 1;
    if (s.turns > 0) remaining.push(s);
  }
  c.enemy.statuses = remaining;
}

function enemyTurn(state: GameState) {
  const c = state.combat;
  if (!c || c.ended) return;
  const enemy = c.enemy;
  const p = state.player;

  // stunned?
  if (enemy.statuses.some((s) => s.kind === "stun")) {
    logPush(c, { kind: "system", text: `${enemy.def.name} is stunned and staggers.` });
    c.turn = "player";
    state.onUpdate?.();
    return;
  }

  // Mana drain aura
  if (enemy.def.aura === "mana_drain") {
    const drained = Math.min(3, p.currentMana);
    p.currentMana -= drained;
    if (drained > 0) logPush(c, { kind: "system", text: `${enemy.def.name}'s aura drains ${drained} mana.` });
  }

  const dmg = Math.max(1, enemy.def.might - p.defense);
  p.currentHp -= dmg;
  logPush(c, { kind: "dmg", text: `${enemy.def.name} hits you for ${dmg}.` });
  c.playerDamagedTick = Date.now();

  if (p.currentHp <= 0) {
    resolveLose(state);
    return;
  }
  c.turn = "player";
  state.onUpdate?.();
}

function resolveWin(state: GameState) {
  const c = state.combat!;
  c.ended = true;
  c.outcome = "win";
  const e = c.enemy.def;
  state.player.xp += e.xp;
  state.player.crystals += e.crystals;
  logPush(c, { kind: "system", text: `Victory! +${e.xp} XP, +${e.crystals} crystals.` });
  if (state.player.xp >= state.player.level * 30) {
    state.player.level += 1;
    state.player.maxHp += 6;
    state.player.currentHp += 6;
    state.player.maxMana += 4;
    state.player.currentMana += 4;
    state.player.might += 1;
    state.player.power += 1;
    logPush(c, { kind: "system", text: `Level up! Lv ${state.player.level}.` });
  }
  if (c.usedCraftedSpellThisFight) {
    const key = `${state.currentFloor}`;
    state.craftedSpellUsedOnFloor[key] = true;
  }
  state.onUpdate?.();
}

function resolveLose(state: GameState) {
  const c = state.combat!;
  c.ended = true;
  c.outcome = "lose";
  logPush(c, { kind: "system", text: `You fall in battle.` });
  state.view = "defeat";
  state.onUpdate?.();
}

// extend GameState at runtime with an onUpdate callback (not persisted)
declare module "./types" {
  interface GameState {
    onUpdate?: () => void;
  }
}
