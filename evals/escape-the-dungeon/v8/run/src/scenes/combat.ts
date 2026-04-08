// Combat scene - turn-based encounters
import type { KAPLAYCtx } from "kaplay";
import type { Enemy } from "../types";
import {
  getPlayer, setCombatEnemy, addXp, addCrystals,
  markRoomCleared, saveGame, healPlayer, removeItem, addRune,
} from "../systems/gamestate";
import { ENEMIES, SPELLS, ITEMS, RUNES } from "../data/content";
import { drawCombatBar } from "./hud";

type CombatPhase = "player_turn" | "enemy_turn" | "victory" | "defeat" | "fled" | "spell_select" | "bag_select";

const ENEMY_EMOJIS: Record<string, string> = {
  slime: "\u{1F7E2}",
  skeleton: "\u{1F480}",
  dark_mage: "\u{1F9D9}",
  boss_golem: "\u{1FAA8}",
};

let combatPhase: CombatPhase = "player_turn";
let combatLog: string[] = [];
let currentEnemy: Enemy | null = null;
let animating = false;

export function combatScene(k: KAPLAYCtx, enemyId: string) {
  const enemyTemplate = ENEMIES[enemyId];
  if (!enemyTemplate) {
    k.go("room");
    return;
  }

  currentEnemy = {
    ...enemyTemplate,
    stats: { ...enemyTemplate.stats },
  };
  setCombatEnemy(currentEnemy);
  combatPhase = "player_turn";
  combatLog = [`A ${currentEnemy.name} appears!`];
  animating = false;

  renderCombat(k);
}

function renderCombat(k: KAPLAYCtx) {
  // Destroy everything and re-render
  k.get("*").forEach(obj => k.destroy(obj));

  const W = k.width();
  const H = k.height();
  const player = getPlayer();
  const enemy = currentEnemy;

  if (!enemy) {
    k.go("room");
    return;
  }

  // Background
  k.add([
    k.rect(W, H),
    k.pos(0, 0),
    k.color(15, 8, 8),
  ]);

  // Title bar
  k.add([
    k.rect(W, 40),
    k.pos(0, 0),
    k.color(25, 12, 12),
  ]);
  k.add([
    k.text(`\u{2694}\u{FE0F} COMBAT - ${enemy.name}`, { size: 18, font: "monospace" }),
    k.pos(15, 10),
    k.color(220, 100, 100),
  ]);

  // Enemy panel (right side)
  const epX = W / 2 + 20;
  const epY = 55;
  const epW = W / 2 - 40;

  k.add([
    k.rect(epW, 220, { radius: 10 }),
    k.pos(epX, epY),
    k.color(25, 18, 18),
    k.outline(2, k.Color.fromHex(enemy.spriteColor)),
  ]);

  // Enemy name
  k.add([
    k.text(enemy.name, { size: 18, font: "monospace" }),
    k.pos(epX + 15, epY + 10),
    k.color(220, 160, 160),
  ]);

  // Enemy HP bar
  drawCombatBar(k, epX + 15, epY + 35, epW - 30, 22,
    enemy.stats.currentHp, enemy.stats.maxHp, [220, 50, 50], [80, 20, 20], "HP");

  // Enemy emoji sprite (large centered)
  const emoji = ENEMY_EMOJIS[enemy.id] ?? "\u{1F47E}";
  k.add([
    k.text(emoji, { size: 64 }),
    k.pos(epX + epW / 2, epY + 120),
    k.anchor("center"),
  ]);

  // Enemy sprite body (colored shape behind emoji)
  k.add([
    k.circle(45),
    k.pos(epX + epW / 2, epY + 120),
    k.anchor("center"),
    k.color(k.Color.fromHex(enemy.spriteColor)),
    k.opacity(0.25),
  ]);

  // Enemy description
  k.add([
    k.text(enemy.description, { size: 11, font: "monospace", width: epW - 30 }),
    k.pos(epX + 15, epY + 175),
    k.color(140, 120, 120),
  ]);

  // Player panel (left side)
  const ppX = 20;
  const ppY = 55;
  const ppW = W / 2 - 40;

  k.add([
    k.rect(ppW, 220, { radius: 10 }),
    k.pos(ppX, ppY),
    k.color(18, 18, 30),
    k.outline(2, k.Color.fromArray([60, 80, 160])),
  ]);

  // Player name and level
  k.add([
    k.text(`${player.name} Lv.${player.level}`, { size: 18, font: "monospace" }),
    k.pos(ppX + 15, ppY + 10),
    k.color(160, 180, 220),
  ]);

  // Player HP bar
  drawCombatBar(k, ppX + 15, ppY + 35, ppW - 30, 22,
    player.stats.currentHp, player.stats.maxHp, [220, 50, 50], [80, 20, 20], "HP");

  // Player Mana bar
  drawCombatBar(k, ppX + 15, ppY + 62, ppW - 30, 18,
    player.stats.currentMana, player.stats.maxMana, [50, 100, 220], [20, 30, 80], "MP");

  // Player stats
  k.add([
    k.text(`Might: ${player.stats.might}  Def: ${player.stats.defense}  Agi: ${player.stats.agility}`, { size: 12, font: "monospace" }),
    k.pos(ppX + 15, ppY + 88),
    k.color(120, 130, 160),
  ]);

  // Player sprite (emoji knight)
  k.add([
    k.text("\u{1F6E1}\u{FE0F}", { size: 56 }),
    k.pos(ppX + ppW / 2, ppY + 150),
    k.anchor("center"),
  ]);
  // Player aura
  k.add([
    k.circle(40),
    k.pos(ppX + ppW / 2, ppY + 150),
    k.anchor("center"),
    k.color(60, 80, 160),
    k.opacity(0.2),
  ]);

  // Combat log panel
  const logY = 285;
  k.add([
    k.rect(W - 40, 90, { radius: 8 }),
    k.pos(20, logY),
    k.color(15, 15, 25),
    k.outline(1, k.Color.fromArray([40, 45, 65])),
  ]);

  const recentLogs = combatLog.slice(-4);
  recentLogs.forEach((log, i) => {
    k.add([
      k.text(log, { size: 13, font: "monospace", width: W - 80 }),
      k.pos(35, logY + 8 + i * 20),
      k.color(i === recentLogs.length - 1 ? 220 : 120, i === recentLogs.length - 1 ? 220 : 125, i === recentLogs.length - 1 ? 240 : 150),
    ]);
  });

  // Action buttons
  const actY = 390;

  if (combatPhase === "player_turn") {
    makeCombatButton(k, W * 0.14, actY, 150, 44, "\u{2694}\u{FE0F} Fight", () => {
      playerAttack(k);
    }, "#cc5533");

    makeCombatButton(k, W * 0.38, actY, 150, 44, "\u{2728} Spells", () => {
      combatPhase = "spell_select";
      renderCombat(k);
    }, "#5533cc");

    makeCombatButton(k, W * 0.62, actY, 150, 44, "\u{1F392} Bag", () => {
      combatPhase = "bag_select";
      renderCombat(k);
    }, "#33aa55");

    makeCombatButton(k, W * 0.84, actY, 120, 44, "\u{1F3C3} Run", () => {
      playerRun(k);
    }, "#888888");

  } else if (combatPhase === "spell_select") {
    k.add([
      k.text("Select a spell:", { size: 14, font: "monospace" }),
      k.pos(30, actY - 15),
      k.color(180, 140, 255),
    ]);

    const playerSpells = player.spells;
    if (playerSpells.length === 0) {
      k.add([
        k.text("No spells! Visit the Rune Forge to craft some.", { size: 13, font: "monospace" }),
        k.pos(30, actY + 10),
        k.color(140, 145, 170),
      ]);
    }

    playerSpells.forEach((spellId, i) => {
      const spell = SPELLS[spellId];
      if (!spell) return;
      const canCast = player.stats.currentMana >= spell.manaCost;
      const col = canCast ? spell.color : "#444444";

      makeCombatButton(k, 30 + (i % 4) * 220 + 100, actY + 10 + Math.floor(i / 4) * 50, 200, 40,
        `${spell.icon} ${spell.name} (${spell.manaCost}MP, ${spell.damage}dmg)`,
        () => { if (canCast) castSpell(k, spellId); },
        col);
    });

    makeCombatButton(k, W - 80, H - 40, 120, 36, "\u{2B05}\u{FE0F} Back", () => {
      combatPhase = "player_turn";
      renderCombat(k);
    }, "#666666");

  } else if (combatPhase === "bag_select") {
    k.add([
      k.text("Select an item:", { size: 14, font: "monospace" }),
      k.pos(30, actY - 15),
      k.color(100, 200, 120),
    ]);

    const items = player.items;
    if (items.length === 0) {
      k.add([
        k.text("Your bag is empty!", { size: 13, font: "monospace" }),
        k.pos(30, actY + 10),
        k.color(140, 145, 170),
      ]);
    }

    const itemCounts: Record<string, number> = {};
    items.forEach(id => { itemCounts[id] = (itemCounts[id] || 0) + 1; });

    Object.keys(itemCounts).forEach((itemId, i) => {
      const item = ITEMS[itemId];
      if (!item) return;
      makeCombatButton(k, 30 + i * 210 + 100, actY + 10, 190, 40,
        `${item.icon} ${item.name} x${itemCounts[itemId]}`,
        () => { useItem(k, itemId); },
        "#33aa55");
    });

    makeCombatButton(k, W - 80, H - 40, 120, 36, "\u{2B05}\u{FE0F} Back", () => {
      combatPhase = "player_turn";
      renderCombat(k);
    }, "#666666");

  } else if (combatPhase === "victory") {
    k.add([
      k.text("\u{1F3C6} VICTORY!", { size: 28, font: "monospace" }),
      k.pos(W / 2, actY - 5),
      k.anchor("center"),
      k.color(255, 215, 0),
    ]);

    k.add([
      k.text(`+${enemy.xpReward} XP  +${enemy.crystalReward} Crystals`, { size: 16, font: "monospace" }),
      k.pos(W / 2, actY + 30),
      k.anchor("center"),
      k.color(200, 200, 120),
    ]);

    // Random rune drop
    const runeKeys = Object.keys(RUNES);
    const droppedRune = Math.random() < 0.4 ? runeKeys[Math.floor(Math.random() * runeKeys.length)] : null;
    if (droppedRune) {
      const rune = RUNES[droppedRune];
      addRune(droppedRune);
      k.add([
        k.text(`${rune.icon} Found: ${rune.name}!`, { size: 14, font: "monospace" }),
        k.pos(W / 2, actY + 55),
        k.anchor("center"),
        k.color(180, 140, 255),
      ]);
    }

    makeCombatButton(k, W / 2, actY + 95, 240, 48, "\u{27A1}\u{FE0F} Continue", () => {
      saveGame();
      k.go("room");
    }, "#44aa44");

  } else if (combatPhase === "defeat") {
    k.add([
      k.text("\u{1F480} DEFEATED", { size: 28, font: "monospace" }),
      k.pos(W / 2, actY),
      k.anchor("center"),
      k.color(200, 50, 50),
    ]);

    k.add([
      k.text("Your adventure ends here...", { size: 14, font: "monospace" }),
      k.pos(W / 2, actY + 35),
      k.anchor("center"),
      k.color(160, 100, 100),
    ]);

    makeCombatButton(k, W / 2, actY + 80, 240, 48, "Return to Title", () => {
      k.go("title");
    }, "#cc3333");

  } else if (combatPhase === "fled") {
    k.add([
      k.text("\u{1F3C3} Escaped!", { size: 24, font: "monospace" }),
      k.pos(W / 2, actY + 10),
      k.anchor("center"),
      k.color(180, 180, 100),
    ]);

    makeCombatButton(k, W / 2, actY + 60, 240, 48, "\u{27A1}\u{FE0F} Continue", () => {
      saveGame();
      k.go("room");
    }, "#888888");
  }
}

function playerAttack(k: KAPLAYCtx) {
  if (animating || !currentEnemy) return;
  animating = true;
  const player = getPlayer();

  const damage = Math.max(1, player.stats.might - currentEnemy.stats.defense + Math.floor(Math.random() * 4));
  currentEnemy.stats.currentHp = Math.max(0, currentEnemy.stats.currentHp - damage);
  combatLog.push(`You attack for ${damage} damage!`);

  if (currentEnemy.stats.currentHp <= 0) {
    handleVictory(k);
    return;
  }

  k.wait(0.3, () => { enemyTurn(k); });
}

function castSpell(k: KAPLAYCtx, spellId: string) {
  if (animating || !currentEnemy) return;
  animating = true;
  const player = getPlayer();
  const spell = SPELLS[spellId];

  if (!spell || player.stats.currentMana < spell.manaCost) {
    animating = false;
    return;
  }

  player.stats.currentMana -= spell.manaCost;
  const damage = spell.damage + Math.floor(player.stats.power * 0.5);
  currentEnemy.stats.currentHp = Math.max(0, currentEnemy.stats.currentHp - damage);
  combatLog.push(`${spell.icon} ${spell.name} deals ${damage} damage!`);

  if (currentEnemy.stats.currentHp <= 0) {
    handleVictory(k);
    return;
  }

  k.wait(0.3, () => { enemyTurn(k); });
}

function useItem(k: KAPLAYCtx, itemId: string) {
  if (animating) return;
  animating = true;
  const player = getPlayer();
  const item = ITEMS[itemId];

  if (!item) { animating = false; return; }

  removeItem(itemId);

  switch (item.effect) {
    case "heal_hp":
      healPlayer(item.value, 0);
      combatLog.push(`${item.icon} Used ${item.name}! +${item.value} HP`);
      break;
    case "heal_mana":
      healPlayer(0, item.value);
      combatLog.push(`${item.icon} Used ${item.name}! +${item.value} MP`);
      break;
    case "buff_might":
      player.stats.might += item.value;
      combatLog.push(`${item.icon} Used ${item.name}! Might +${item.value}`);
      break;
  }

  k.wait(0.3, () => { enemyTurn(k); });
}

function playerRun(k: KAPLAYCtx) {
  if (animating || !currentEnemy) return;
  animating = true;
  const player = getPlayer();

  const fleeChance = player.stats.agility / (player.stats.agility + currentEnemy.stats.agility);
  if (Math.random() < fleeChance) {
    combatLog.push("You escaped successfully!");
    combatPhase = "fled";
    setCombatEnemy(null);
    animating = false;
    renderCombat(k);
  } else {
    combatLog.push("Couldn't escape!");
    k.wait(0.3, () => { enemyTurn(k); });
  }
}

function enemyTurn(k: KAPLAYCtx) {
  if (!currentEnemy) return;
  const player = getPlayer();

  const damage = Math.max(1, currentEnemy.stats.might - player.stats.defense + Math.floor(Math.random() * 3));
  player.stats.currentHp = Math.max(0, player.stats.currentHp - damage);
  combatLog.push(`${currentEnemy.name} attacks for ${damage} damage!`);

  if (player.stats.currentHp <= 0) {
    handleDefeat(k);
    return;
  }

  combatPhase = "player_turn";
  animating = false;
  renderCombat(k);
}

function handleVictory(k: KAPLAYCtx) {
  if (!currentEnemy) return;
  const player = getPlayer();

  addXp(currentEnemy.xpReward);
  addCrystals(currentEnemy.crystalReward);
  markRoomCleared(player.currentRoomId);

  combatPhase = "victory";
  animating = false;
  renderCombat(k);
  setCombatEnemy(null);
}

function handleDefeat(k: KAPLAYCtx) {
  combatPhase = "defeat";
  animating = false;
  renderCombat(k);
  setCombatEnemy(null);
}

function makeCombatButton(
  k: KAPLAYCtx, x: number, y: number, w: number, h: number,
  label: string, action: () => void, accentColor: string,
) {
  const bg = k.add([
    k.rect(w, h, { radius: 6 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(25, 28, 45),
    k.outline(2, k.Color.fromHex(accentColor)),
    k.area(),
  ]);

  k.add([
    k.text(label, { size: 12, font: "monospace", width: w - 12, align: "center" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(220, 220, 240),
  ]);

  bg.onHoverUpdate(() => {
    bg.color = k.Color.fromHex(accentColor).darken(160);
    k.setCursor("pointer");
  });
  bg.onHoverEnd(() => {
    bg.color = k.Color.fromArray([25, 28, 45]);
    k.setCursor("default");
  });
  bg.onClick(action);
}
