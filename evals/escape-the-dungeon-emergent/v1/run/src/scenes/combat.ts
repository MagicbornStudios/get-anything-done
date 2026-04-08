import type { KAPLAYCtx } from "kaplay";
import { makeButton, makeText, makePanel, makeHpBar, COLORS } from "../ui";
import { getState, saveGame } from "../state";
import { ContentManager } from "../content";
import type { CombatStats } from "../types";

const TAG = "combat-ui";

interface CombatState {
  enemyName: string;
  enemyStats: CombatStats;
  isBoss: boolean;
  log: string[];
  shieldBonus: number;
  turn: "player" | "enemy" | "victory" | "defeat";
}

let combat: CombatState | null = null;

function addLog(msg: string) {
  if (combat) {
    combat.log.push(msg);
    if (combat.log.length > 5) combat.log.shift();
  }
}

function enemyTurn(k: KAPLAYCtx) {
  if (!combat) return;
  const state = getState();
  if (!state) return;

  const player = state.player;
  const enemy = combat.enemyStats;

  // Enemy attacks
  const baseDmg = Math.max(1, enemy.might - (player.stats.defense + combat.shieldBonus));
  const dmg = Math.max(1, baseDmg + Math.floor(Math.random() * 4) - 2);
  player.stats.currentHp = Math.max(0, player.stats.currentHp - dmg);
  addLog(`${combat.enemyName} attacks for ${dmg} damage!`);

  // Reset shield bonus each turn
  combat.shieldBonus = 0;

  if (player.stats.currentHp <= 0) {
    combat.turn = "defeat";
  } else {
    combat.turn = "player";
  }

  renderCombat(k);
}

function renderCombat(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  if (!combat) return;
  const state = getState();
  if (!state) return;
  const player = state.player;

  // Title
  const title = combat.isBoss ? "BOSS BATTLE!" : "COMBAT";
  makeText(k, title, 400, 30, TAG, {
    size: 28,
    color: combat.isBoss ? COLORS.danger : COLORS.accent,
  });

  // Enemy panel
  makePanel(k, 400, 120, 350, 140, TAG, [50, 30, 30]);

  makeText(k, combat.enemyName, 400, 70, TAG, {
    size: 22,
    color: COLORS.danger,
  });

  // Enemy sprite placeholder
  k.add([
    k.rect(60, 60, { radius: 8 }),
    k.pos(400, 115),
    k.anchor("center"),
    k.color(180, 60, 60),
    TAG,
  ]);
  makeText(k, combat.enemyName[0], 400, 115, TAG, { size: 32, color: COLORS.text });

  // Enemy HP
  makeText(k, "HP", 300, 160, TAG, { size: 12, anchor: "left", color: COLORS.hp });
  makeHpBar(k, 320, 160, 160, combat.enemyStats.currentHp, combat.enemyStats.maxHp, TAG, COLORS.hp);

  // Player panel
  makePanel(k, 400, 290, 350, 100, TAG, [30, 30, 50]);

  makeText(k, player.name, 400, 250, TAG, {
    size: 18,
    color: COLORS.accent,
  });

  makeText(k, "HP", 280, 280, TAG, { size: 12, anchor: "left", color: COLORS.hp });
  makeHpBar(k, 300, 280, 130, player.stats.currentHp, player.stats.maxHp, TAG, COLORS.hp);

  makeText(k, "MP", 280, 300, TAG, { size: 12, anchor: "left", color: COLORS.mana });
  makeHpBar(k, 300, 300, 130, player.stats.currentMana, player.stats.maxMana, TAG, COLORS.mana);

  // Combat log
  makePanel(k, 400, 390, 700, 80, TAG, [25, 25, 35]);
  combat.log.forEach((msg, i) => {
    makeText(k, msg, 70, 365 + i * 16, TAG, {
      size: 12,
      anchor: "left",
      color: i === combat!.log.length - 1 ? COLORS.text : COLORS.textDim,
    });
  });

  // Victory or defeat
  if (combat.turn === "victory") {
    const xpGain = combat.isBoss ? 50 : 20;
    const crystalGain = combat.isBoss ? 25 : 10;
    player.xp += xpGain;
    player.crystals += crystalGain;

    // Level up check
    if (player.xp >= player.xpToNext) {
      player.level += 1;
      player.xp -= player.xpToNext;
      player.xpToNext = Math.floor(player.xpToNext * 1.5);
      player.stats.maxHp += 10;
      player.stats.currentHp = Math.min(player.stats.currentHp + 10, player.stats.maxHp);
      player.stats.maxMana += 5;
      player.stats.might += 1;
      player.stats.defense += 1;
      addLog(`Level up! Now level ${player.level}!`);
    }

    saveGame();

    makeText(k, "VICTORY!", 400, 470, TAG, { size: 32, color: COLORS.success });
    makeText(k, `+${xpGain} XP, +${crystalGain} Crystals`, 400, 500, TAG, {
      size: 16,
      color: COLORS.gold,
    });

    makeButton(k, "Continue", 400, 550, 200, 45, TAG, () => {
      k.go("room");
    }, COLORS.success);
    return;
  }

  if (combat.turn === "defeat") {
    makeText(k, "DEFEATED!", 400, 470, TAG, { size: 32, color: COLORS.danger });
    makeText(k, "You have fallen...", 400, 500, TAG, {
      size: 16,
      color: COLORS.textDim,
    });

    makeButton(k, "Return to Title", 400, 550, 200, 45, TAG, () => {
      k.go("title");
    }, COLORS.danger);
    return;
  }

  // Action buttons (only on player turn)
  if (combat.turn === "player") {
    const btnY = 480;

    makeButton(k, "Fight", 200, btnY, 140, 40, TAG, () => {
      if (!combat) return;
      const dmg = Math.max(1, player.stats.might - combat.enemyStats.defense + Math.floor(Math.random() * 5));
      combat.enemyStats.currentHp = Math.max(0, combat.enemyStats.currentHp - dmg);
      addLog(`You attack for ${dmg} damage!`);

      if (combat.enemyStats.currentHp <= 0) {
        combat.turn = "victory";
        addLog(`${combat.enemyName} is defeated!`);
        renderCombat(k);
      } else {
        combat.turn = "enemy";
        enemyTurn(k);
      }
    }, COLORS.danger);

    makeButton(k, "Spells", 370, btnY, 140, 40, TAG, () => {
      renderSpellMenu(k);
    }, COLORS.mana);

    makeButton(k, "Bag", 540, btnY, 140, 40, TAG, () => {
      renderBagMenu(k);
    }, COLORS.gold);

    makeButton(k, "Run", 660, btnY, 100, 40, TAG, () => {
      if (!combat) return;
      const fleeChance = player.stats.agility / (player.stats.agility + combat.enemyStats.agility);
      if (Math.random() < fleeChance) {
        addLog("You fled successfully!");
        k.go("room");
      } else {
        addLog("Failed to flee!");
        combat.turn = "enemy";
        enemyTurn(k);
      }
    }, COLORS.panelLight);
  }
}

function renderSpellMenu(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state || !combat) return;
  const player = state.player;

  makeText(k, "Cast a Spell", 400, 50, TAG, { size: 24, color: COLORS.mana });

  player.spells.forEach((spellId, i) => {
    const spell = ContentManager.getSpell(spellId);
    if (!spell) return;

    const canCast = player.stats.currentMana >= spell.manaCost;
    const label = `${spell.name} (${spell.manaCost} MP) - ${spell.description}`;

    makeButton(k, label, 400, 120 + i * 55, 600, 40, TAG, () => {
      if (!canCast || !combat) return;

      player.stats.currentMana -= spell.manaCost;

      if (spell.damage < 0) {
        // Healing spell
        const heal = Math.abs(spell.damage);
        player.stats.currentHp = Math.min(player.stats.maxHp, player.stats.currentHp + heal);
        addLog(`You cast ${spell.name}! Restored ${heal} HP!`);
      } else if (spell.damage === 0) {
        // Shield/buff spell
        combat.shieldBonus += 5;
        addLog(`You cast ${spell.name}! Defense boosted!`);
      } else {
        // Damage spell
        const dmg = spell.damage + Math.floor(player.stats.power * 0.5);
        combat.enemyStats.currentHp = Math.max(0, combat.enemyStats.currentHp - dmg);
        addLog(`You cast ${spell.name} for ${dmg} damage!`);
      }

      // Check if drain spell
      if (spell.id === "drain") {
        player.stats.currentMana = Math.min(player.stats.maxMana, player.stats.currentMana + 5);
      }

      if (combat.enemyStats.currentHp <= 0) {
        combat.turn = "victory";
        addLog(`${combat.enemyName} is defeated!`);
        renderCombat(k);
      } else {
        combat.turn = "enemy";
        enemyTurn(k);
      }
    }, canCast ? COLORS.mana : COLORS.panelLight);
  });

  makeButton(k, "Back", 400, 120 + player.spells.length * 55 + 20, 150, 40, TAG, () => {
    renderCombat(k);
  }, COLORS.textDim);
}

function renderBagMenu(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state || !combat) return;
  const player = state.player;

  makeText(k, "Use an Item", 400, 50, TAG, { size: 24, color: COLORS.gold });

  const usableItems = player.inventory.filter((inv) => inv.quantity > 0);

  if (usableItems.length === 0) {
    makeText(k, "No items in bag.", 400, 150, TAG, { size: 16, color: COLORS.textDim });
  }

  usableItems.forEach((inv, i) => {
    const item = ContentManager.getItem(inv.itemId);
    if (!item) return;

    const label = `${item.name} x${inv.quantity} - ${item.description}`;

    makeButton(k, label, 400, 120 + i * 55, 500, 40, TAG, () => {
      if (!combat) return;

      inv.quantity -= 1;

      if (item.effect === "heal_hp") {
        player.stats.currentHp = Math.min(player.stats.maxHp, player.stats.currentHp + item.value);
        addLog(`Used ${item.name}! +${item.value} HP`);
      } else if (item.effect === "heal_mana") {
        player.stats.currentMana = Math.min(player.stats.maxMana, player.stats.currentMana + item.value);
        addLog(`Used ${item.name}! +${item.value} MP`);
      }

      // Remove empty stacks
      player.inventory = player.inventory.filter((x) => x.quantity > 0);

      combat.turn = "enemy";
      enemyTurn(k);
    }, COLORS.gold);
  });

  makeButton(k, "Back", 400, 120 + Math.max(usableItems.length, 1) * 55 + 20, 150, 40, TAG, () => {
    renderCombat(k);
  }, COLORS.textDim);
}

export function combatScene(k: KAPLAYCtx, data: { enemyId: string; isBoss: boolean }) {
  const entityType = ContentManager.getEntityType(data.enemyId);
  if (!entityType) {
    k.go("room");
    return;
  }

  const base = entityType.baseStats;
  const enemyStats: CombatStats = {
    maxHp: base.maxHp ?? 50,
    currentHp: base.maxHp ?? 50,
    maxMana: base.maxMana ?? 10,
    currentMana: base.maxMana ?? 10,
    might: base.might ?? 8,
    agility: base.agility ?? 8,
    defense: base.defense ?? 4,
    power: base.power ?? 5,
    insight: base.insight ?? 5,
    willpower: base.willpower ?? 5,
  };

  combat = {
    enemyName: entityType.name,
    enemyStats,
    isBoss: data.isBoss,
    log: [`A wild ${entityType.name} appears!`],
    shieldBonus: 0,
    turn: "player",
  };

  renderCombat(k);
}
