// Combat scene — turn-based encounters
// CRITICAL: Must always return to room scene after combat (GAD v7 failure)

import type { KAPLAYCtx } from "kaplay";
import type { GameState, CombatStats } from "../types";
import { getContent } from "../content";
import { addXP, tickBuffs, getBuffedStat, saveGame } from "../state";
import {
  COLORS,
  addButton,
  addPanel,
  addBar,
  addEntityPortrait,
  addTitle,
  addLabel,
} from "../ui";

const TAG = "combat-ui";

interface CombatState {
  enemyName: string;
  enemyColor: string;
  enemyIcon: string;
  enemyStats: CombatStats;
  enemyMaxHp: number;
  turn: "player" | "enemy";
  log: string[];
  resolved: boolean;
  won: boolean;
  xpReward: number;
  crystalReward: number;
}

export function registerCombatScene(k: KAPLAYCtx): void {
  k.scene("combat", (sceneData: { gameState: GameState; enemyTypeId: string }) => {
    const gs = sceneData.gameState;
    const enemyTypeId = sceneData.enemyTypeId;
    const content = getContent();
    const entityType = content.entityTypes.find((e) => e.id === enemyTypeId);

    if (!entityType) {
      // Fallback: just go back to room
      k.go("room", { gameState: gs });
      return;
    }

    const enemyStats: CombatStats = {
      maxHp: entityType.baseStats.maxHp,
      maxMana: entityType.baseStats.maxMana,
      currentHp: entityType.baseStats.maxHp,
      currentMana: entityType.baseStats.maxMana,
      might: entityType.baseStats.might,
      agility: entityType.baseStats.agility,
      defense: entityType.baseStats.defense,
      power: entityType.baseStats.power,
      insight: entityType.baseStats.insight,
      willpower: entityType.baseStats.willpower,
    };

    const combat: CombatState = {
      enemyName: entityType.name,
      enemyColor: entityType.color,
      enemyIcon: entityType.icon,
      enemyStats,
      enemyMaxHp: entityType.baseStats.maxHp,
      turn: "player",
      log: [`A ${entityType.name} appears!`],
      resolved: false,
      won: false,
      xpReward: Math.floor(entityType.baseStats.maxHp * 0.8),
      crystalReward: Math.floor(entityType.baseStats.maxHp * 0.2) + 3,
    };

    renderCombat(k, gs, combat);
  });
}

function renderCombat(k: KAPLAYCtx, gs: GameState, combat: CombatState): void {
  k.destroyAll(TAG);

  const W = k.width();
  const p = gs.player;

  // ====== Background panel ======
  addPanel(k, W / 2, k.height() / 2, W - 30, k.height() - 30, TAG, {
    color: [18, 14, 22],
    borderColor: COLORS.combat,
  });

  // ====== Enemy section (top) ======
  addEntityPortrait(k, 120, 100, combat.enemyColor, combat.enemyIcon, 80, TAG);

  addTitle(k, combat.enemyName, 280, 70, TAG, { size: 24, color: COLORS.danger });

  // Enemy HP bar
  addBar(k, 200, 100, combat.enemyStats.currentHp, combat.enemyMaxHp, {
    tag: TAG,
    width: 250,
    height: 22,
    fillColor: COLORS.danger,
    bgColor: COLORS.hpBarBg,
    label: "HP",
  });

  // Enemy mana
  if (combat.enemyStats.maxMana > 0) {
    addBar(k, 200, 128, combat.enemyStats.currentMana, combat.enemyStats.maxMana, {
      tag: TAG,
      width: 200,
      height: 14,
      fillColor: COLORS.manaBar,
      bgColor: COLORS.manaBarBg,
      label: "MP",
    });
  }

  // ====== Player section (bottom left) ======
  addPanel(k, 160, 310, 280, 130, TAG, {
    color: [22, 22, 36],
    borderColor: COLORS.accent,
  });

  addLabel(k, `${p.name} Lv.${p.level}`, 50, 260, TAG, {
    size: 18,
    color: COLORS.gold,
  });

  addBar(k, 50, 285, p.combatStats.currentHp, p.combatStats.maxHp, {
    tag: TAG,
    width: 220,
    height: 20,
    fillColor: COLORS.hpBar,
    bgColor: COLORS.hpBarBg,
    label: "HP",
  });

  addBar(k, 50, 312, p.combatStats.currentMana, p.combatStats.maxMana, {
    tag: TAG,
    width: 200,
    height: 16,
    fillColor: COLORS.manaBar,
    bgColor: COLORS.manaBarBg,
    label: "MP",
  });

  // Buffs display
  if (p.buffs.length > 0) {
    const buffText = p.buffs.map((b) => `${b.stat}+${b.amount}(${b.turnsRemaining}t)`).join(" ");
    addLabel(k, `Buffs: ${buffText}`, 50, 340, TAG, { size: 11, color: COLORS.success });
  }

  // ====== Combat log ======
  addPanel(k, W / 2, 450, W - 60, 100, TAG, {
    color: [14, 14, 24],
    borderColor: COLORS.panelBorder,
  });

  const recentLogs = combat.log.slice(-4);
  recentLogs.forEach((line, i) => {
    addLabel(k, line, 50, 415 + i * 18, TAG, {
      size: 13,
      color: i === recentLogs.length - 1 ? COLORS.text : COLORS.textDim,
    });
  });

  // ====== Action buttons or result ======
  if (combat.resolved) {
    renderCombatResult(k, gs, combat, W);
  } else if (combat.turn === "player") {
    renderPlayerActions(k, gs, combat, W);
  }
  // Enemy turn is auto-executed, no button needed
}

function renderPlayerActions(k: KAPLAYCtx, gs: GameState, combat: CombatState, W: number): void {
  const btnY = 530;
  const btnSpacing = 150;
  const startX = W / 2 - (btnSpacing * 1.5);

  // Fight
  addButton(k, "Fight", startX, btnY, {
    tag: TAG, width: 120, height: 44, color: COLORS.combat, fontSize: 18,
    onClick: () => doPlayerAttack(k, gs, combat),
  });

  // Spells
  addButton(k, "Spells", startX + btnSpacing, btnY, {
    tag: TAG, width: 120, height: 44, color: [100, 60, 180], fontSize: 18,
    onClick: () => renderSpellSelect(k, gs, combat, W),
  });

  // Bag
  addButton(k, "Bag", startX + btnSpacing * 2, btnY, {
    tag: TAG, width: 120, height: 44, color: [80, 120, 80], fontSize: 18,
    onClick: () => renderBagSelect(k, gs, combat, W),
  });

  // Run
  addButton(k, "Run", startX + btnSpacing * 3, btnY, {
    tag: TAG, width: 120, height: 44, color: COLORS.textDim, fontSize: 18,
    onClick: () => doRun(k, gs, combat),
  });
}

function doPlayerAttack(k: KAPLAYCtx, gs: GameState, combat: CombatState): void {
  const playerMight = getBuffedStat(gs.player, "might");
  const enemyDef = combat.enemyStats.defense;
  const damage = Math.max(1, playerMight - Math.floor(enemyDef / 2) + Math.floor(Math.random() * 4));

  combat.enemyStats.currentHp -= damage;
  combat.log.push(`You attack for ${damage} damage!`);

  if (combat.enemyStats.currentHp <= 0) {
    combat.enemyStats.currentHp = 0;
    combat.resolved = true;
    combat.won = true;
    combat.log.push(`${combat.enemyName} defeated!`);
    const leveled = addXP(gs.player, combat.xpReward);
    gs.player.crystals += combat.crystalReward;
    combat.log.push(`+${combat.xpReward} XP, +${combat.crystalReward} crystals!`);
    if (leveled) combat.log.push(`Level Up! Now level ${gs.player.level}!`);
    tickBuffs(gs.player);
    saveGame(gs);
    renderCombat(k, gs, combat);
    return;
  }

  // Enemy turn
  tickBuffs(gs.player);
  doEnemyTurn(k, gs, combat);
}

function doEnemyTurn(k: KAPLAYCtx, gs: GameState, combat: CombatState): void {
  const enemyMight = combat.enemyStats.might;
  const playerDef = getBuffedStat(gs.player, "defense");
  const damage = Math.max(1, enemyMight - Math.floor(playerDef / 2) + Math.floor(Math.random() * 3));

  gs.player.combatStats.currentHp -= damage;
  combat.log.push(`${combat.enemyName} attacks for ${damage} damage!`);

  if (gs.player.combatStats.currentHp <= 0) {
    gs.player.combatStats.currentHp = 0;
    combat.resolved = true;
    combat.won = false;
    combat.log.push("You have been defeated...");
  }

  renderCombat(k, gs, combat);
}

function renderSpellSelect(k: KAPLAYCtx, gs: GameState, combat: CombatState, _W: number): void {
  k.destroyAll(TAG);

  const content = getContent();
  const equippedSpells = gs.player.equippedSpells
    .map((id) => content.recipes.find((r) => r.id === id))
    .filter(Boolean);

  addPanel(k, k.width() / 2, k.height() / 2, 400, 400, TAG, {
    color: [20, 16, 32],
    borderColor: [120, 80, 200],
  });

  addTitle(k, "Cast a Spell", k.width() / 2, 120, TAG, { size: 24, color: [180, 130, 255] });

  if (equippedSpells.length === 0) {
    addLabel(k, "No spells equipped. Visit the Forge!", k.width() / 2, 200, TAG, {
      size: 16, color: COLORS.textDim, anchor: "center",
    });
  }

  equippedSpells.forEach((spell, i) => {
    if (!spell) return;
    const y = 170 + i * 55;
    const canCast = gs.player.combatStats.currentMana >= spell.manaCost;

    addButton(k, `${spell.name} (${spell.manaCost} MP)`, k.width() / 2, y, {
      tag: TAG,
      width: 300,
      height: 42,
      color: canCast ? [100, 60, 180] : [50, 40, 60],
      fontSize: 16,
      onClick: () => {
        if (!canCast) return;
        castSpell(k, gs, combat, spell.id);
      },
    });

    addLabel(k, spell.description, k.width() / 2, y + 26, TAG, {
      size: 11, color: COLORS.textDim, anchor: "center",
    });
  });

  addButton(k, "Back", k.width() / 2, k.height() - 80, {
    tag: TAG, width: 140, height: 36, color: COLORS.textDim, fontSize: 16,
    onClick: () => renderCombat(k, gs, combat),
  });
}

function castSpell(k: KAPLAYCtx, gs: GameState, combat: CombatState, spellId: string): void {
  const content = getContent();
  const spell = content.recipes.find((r) => r.id === spellId);
  if (!spell) return;

  gs.player.combatStats.currentMana -= spell.manaCost;

  if (spell.damage > 0) {
    const totalDamage = spell.damage + Math.floor(gs.player.combatStats.power * 0.5);
    combat.enemyStats.currentHp -= totalDamage;
    combat.log.push(`You cast ${spell.name} for ${totalDamage} damage!`);
  }

  if (spell.effect) {
    if (spell.effect.type === "heal") {
      const healAmt = spell.effect.amount;
      gs.player.combatStats.currentHp = Math.min(
        gs.player.combatStats.maxHp,
        gs.player.combatStats.currentHp + healAmt
      );
      combat.log.push(`${spell.name} heals you for ${healAmt} HP!`);
    } else if (spell.effect.type === "buff") {
      gs.player.buffs.push({
        stat: spell.effect.stat || "defense",
        amount: spell.effect.amount,
        turnsRemaining: spell.effect.duration || 3,
      });
      combat.log.push(`${spell.name} buffs your ${spell.effect.stat}!`);
    }
  }

  if (combat.enemyStats.currentHp <= 0) {
    combat.enemyStats.currentHp = 0;
    combat.resolved = true;
    combat.won = true;
    combat.log.push(`${combat.enemyName} defeated!`);
    const leveled = addXP(gs.player, combat.xpReward);
    gs.player.crystals += combat.crystalReward;
    combat.log.push(`+${combat.xpReward} XP, +${combat.crystalReward} crystals!`);
    if (leveled) combat.log.push(`Level Up! Now level ${gs.player.level}!`);
    tickBuffs(gs.player);
    saveGame(gs);
    renderCombat(k, gs, combat);
    return;
  }

  tickBuffs(gs.player);
  doEnemyTurn(k, gs, combat);
}

function renderBagSelect(k: KAPLAYCtx, gs: GameState, combat: CombatState, _W: number): void {
  k.destroyAll(TAG);

  const content = getContent();
  const cx = k.width() / 2;

  addPanel(k, cx, k.height() / 2, 400, 350, TAG, {
    color: [20, 24, 20],
    borderColor: [80, 140, 80],
  });

  addTitle(k, "Use Item", cx, 140, TAG, { size: 24, color: COLORS.success });

  const usableItems = Object.entries(gs.player.items)
    .filter(([_, count]) => count > 0)
    .map(([id, count]) => ({ item: content.items.find((i) => i.id === id), count }))
    .filter((e) => e.item);

  if (usableItems.length === 0) {
    addLabel(k, "No items in bag.", cx, 220, TAG, {
      size: 16, color: COLORS.textDim, anchor: "center",
    });
  }

  usableItems.forEach(({ item, count }, i) => {
    if (!item) return;
    const y = 190 + i * 50;

    addButton(k, `${item.name} x${count}`, cx, y, {
      tag: TAG, width: 280, height: 38, color: [80, 120, 80], fontSize: 16,
      onClick: () => {
        useItem(k, gs, combat, item.id);
      },
    });
  });

  addButton(k, "Back", cx, k.height() - 80, {
    tag: TAG, width: 140, height: 36, color: COLORS.textDim, fontSize: 16,
    onClick: () => renderCombat(k, gs, combat),
  });
}

function useItem(k: KAPLAYCtx, gs: GameState, combat: CombatState, itemId: string): void {
  const content = getContent();
  const item = content.items.find((i) => i.id === itemId);
  if (!item || !gs.player.items[itemId] || gs.player.items[itemId] <= 0) return;

  gs.player.items[itemId] -= 1;

  if (item.effect?.type === "heal") {
    const healAmt = item.effect.amount;
    gs.player.combatStats.currentHp = Math.min(
      gs.player.combatStats.maxHp,
      gs.player.combatStats.currentHp + healAmt
    );
    combat.log.push(`Used ${item.name}, healed ${healAmt} HP!`);
  } else if (item.effect?.type === "restoreMana") {
    const manaAmt = item.effect.amount;
    gs.player.combatStats.currentMana = Math.min(
      gs.player.combatStats.maxMana,
      gs.player.combatStats.currentMana + manaAmt
    );
    combat.log.push(`Used ${item.name}, restored ${manaAmt} MP!`);
  }

  // Enemy turn after item use
  tickBuffs(gs.player);
  doEnemyTurn(k, gs, combat);
}

function doRun(k: KAPLAYCtx, gs: GameState, combat: CombatState): void {
  const fleeChance = gs.player.combatStats.agility / (gs.player.combatStats.agility + combat.enemyStats.agility);
  if (Math.random() < fleeChance) {
    combat.log.push("You fled successfully!");
    // Return to room immediately
    k.go("room", { gameState: gs });
  } else {
    combat.log.push("Failed to flee!");
    tickBuffs(gs.player);
    doEnemyTurn(k, gs, combat);
  }
}

function renderCombatResult(k: KAPLAYCtx, gs: GameState, combat: CombatState, _W: number): void {
  const cx = k.width() / 2;

  if (combat.won) {
    addTitle(k, "Victory!", cx, 520, TAG, { size: 28, color: COLORS.gold });

    // CRITICAL: Return to room button — fixes GAD v7 softlock
    addButton(k, "Continue", cx, 570, {
      tag: TAG, width: 200, height: 48, color: COLORS.success, fontSize: 20,
      onClick: () => {
        // Return to room scene — the critical fix from previous runs
        k.go("room", { gameState: gs });
      },
    });
  } else {
    addTitle(k, "Defeated...", cx, 520, TAG, { size: 28, color: COLORS.danger });

    addButton(k, "Return to Last Rest", cx, 570, {
      tag: TAG, width: 220, height: 48, color: COLORS.textDim, fontSize: 16,
      onClick: () => {
        // Revive at entrance with half HP
        gs.player.combatStats.currentHp = Math.floor(gs.player.combatStats.maxHp / 2);
        gs.player.combatStats.currentMana = Math.floor(gs.player.combatStats.maxMana / 2);
        gs.player.currentRoomId = "r1";
        saveGame(gs);
        k.go("room", { gameState: gs });
      },
    });
  }
}
