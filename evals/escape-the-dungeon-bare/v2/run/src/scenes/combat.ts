import { makeButton, addCenteredText, makeBar } from "../systems/ui";
import { getPlayer, saveGame, gainXp, removeItem } from "../systems/state";
import { content } from "../systems/content";
import type { EnemyState, SpellDef } from "../types";

// Combat state lives in module scope so it persists across scene refreshes
let enemyState: EnemyState | null = null;
let combatLog: string[] = [];
let combatRoomId: string = "";
let playerDefenseBonus = 0;
let playerDefenseTurns = 0;

export function combatScene(k: any, roomId: string) {
  combatRoomId = roomId;
  const player = getPlayer();
  const floor = content.getFloor(player.currentFloor);
  const room = floor?.rooms.find((r) => r.id === roomId);

  if (!room || !room.enemyId) {
    addCenteredText(k, "No enemy here!", k.height() / 2, 24);
    return;
  }

  // Initialize enemy if new combat
  if (!enemyState || enemyState.def.id !== room.enemyId || enemyState.currentHp <= 0) {
    const enemyDef = content.getEnemy(room.enemyId);
    if (!enemyDef) return;
    enemyState = {
      def: enemyDef,
      currentHp: enemyDef.stats.maxHp,
      currentMana: enemyDef.stats.maxMana ?? 20,
    };
    combatLog = [`A wild ${enemyDef.name} appears!`];
    playerDefenseBonus = 0;
    playerDefenseTurns = 0;
  }

  const enemy = enemyState;

  // ---- Draw combat UI ----

  // Enemy area (top)
  const entityType = content.getEntityType(enemy.def.entityType);
  const eColor = entityType?.spriteColor ?? [200, 200, 200];

  k.add([
    k.rect(80, 80, { radius: 10 }),
    k.pos(k.width() / 2, 60),
    k.color(eColor[0], eColor[1], eColor[2]),
    k.anchor("center"),
    k.z(10),
  ]);

  addCenteredText(k, `${enemy.def.name} Lv.${enemy.def.level}`, 115, 18, [255, 200, 200]);

  // Enemy HP bar
  makeBar(k, k.width() / 2 - 80, 138, 160, 16, enemy.currentHp, enemy.def.stats.maxHp, [200, 50, 50]);
  k.add([
    k.text(`${enemy.currentHp}/${enemy.def.stats.maxHp}`, { size: 12 }),
    k.pos(k.width() / 2 + 85, 136),
    k.color(255, 200, 200),
    k.z(21),
  ]);

  // Player stats area
  const py = 170;
  k.add([
    k.rect(k.width() - 20, 50),
    k.pos(10, py),
    k.color(20, 20, 50),
    k.z(5),
  ]);

  k.add([
    k.text(`${player.name} Lv.${player.level}`, { size: 14 }),
    k.pos(20, py + 5),
    k.color(255, 255, 255),
    k.z(10),
  ]);

  // Player HP
  makeBar(k, 20, py + 25, 140, 12, player.combatStats.currentHp, player.combatStats.maxHp, [200, 50, 50]);
  k.add([
    k.text(`HP: ${player.combatStats.currentHp}/${player.combatStats.maxHp}`, { size: 10 }),
    k.pos(165, py + 23),
    k.color(255, 200, 200),
    k.z(10),
  ]);

  // Player Mana
  makeBar(k, k.width() / 2 + 10, py + 25, 140, 12, player.combatStats.currentMana, player.combatStats.maxMana, [50, 50, 200]);
  k.add([
    k.text(`MP: ${player.combatStats.currentMana}/${player.combatStats.maxMana}`, { size: 10 }),
    k.pos(k.width() / 2 + 155, py + 23),
    k.color(200, 200, 255),
    k.z(10),
  ]);

  // Combat log
  const logY = 230;
  const logLines = combatLog.slice(-4);
  logLines.forEach((line, i) => {
    k.add([
      k.text(line, { size: 13, width: k.width() - 40 }),
      k.pos(20, logY + i * 20),
      k.color(200, 200, 220),
      k.z(10),
    ]);
  });

  // ---- Action buttons ----
  const actY = 340;

  // Fight
  makeButton(k, {
    label: "Fight",
    x: k.width() * 0.25,
    y: actY,
    width: 130,
    height: 42,
    fontSize: 18,
    onClick: () => doFight(k, player, enemy),
  });

  // Spells
  makeButton(k, {
    label: "Spells",
    x: k.width() * 0.5,
    y: actY,
    width: 130,
    height: 42,
    fontSize: 18,
    onClick: () => k.go("combatSpells", roomId),
  });

  // Bag
  makeButton(k, {
    label: "Bag",
    x: k.width() * 0.75,
    y: actY,
    width: 130,
    height: 42,
    fontSize: 18,
    onClick: () => k.go("combatBag", roomId),
  });

  // Run
  makeButton(k, {
    label: "Run",
    x: k.width() * 0.5,
    y: actY + 55,
    width: 130,
    height: 42,
    fontSize: 18,
    onClick: () => doRun(k, player),
  });
}

function doFight(k: any, player: any, enemy: EnemyState) {
  // Player attacks
  const rawDmg = player.combatStats.might + Math.floor(Math.random() * 5);
  const dmg = Math.max(1, rawDmg - enemy.def.stats.defense);
  enemy.currentHp -= dmg;
  combatLog.push(`You attack for ${dmg} damage!`);

  if (enemy.currentHp <= 0) {
    enemy.currentHp = 0;
    handleVictory(k, player, enemy);
    return;
  }

  // Enemy attacks
  enemyTurn(k, player, enemy);
}

function enemyTurn(k: any, player: any, enemy: EnemyState) {
  const totalDef = player.combatStats.defense + playerDefenseBonus;
  const rawDmg = enemy.def.stats.might + Math.floor(Math.random() * 4);
  const dmg = Math.max(1, rawDmg - totalDef);
  player.combatStats.currentHp -= dmg;
  combatLog.push(`${enemy.def.name} attacks for ${dmg} damage!`);

  if (playerDefenseTurns > 0) {
    playerDefenseTurns--;
    if (playerDefenseTurns <= 0) {
      playerDefenseBonus = 0;
    }
  }

  if (player.combatStats.currentHp <= 0) {
    player.combatStats.currentHp = 0;
    handleDefeat(k, player);
    return;
  }

  saveGame();
  k.go("combat", combatRoomId);
}

function handleVictory(k: any, player: any, enemy: EnemyState) {
  const xpGain = enemy.def.xpReward;
  const crystalGain = enemy.def.crystalReward;
  player.crystals += crystalGain;
  player.defeatedEnemies.push(combatRoomId);

  const leveledUp = gainXp(xpGain);

  combatLog.push(`Victory! +${xpGain} XP, +${crystalGain} crystals!`);
  if (leveledUp) {
    combatLog.push(`Level up! You are now level ${player.level}!`);
  }

  // Check if boss - advance floor
  const floor = content.getFloor(player.currentFloor);
  const room = floor?.rooms.find((r) => r.id === combatRoomId);
  if (room?.type === "boss") {
    player.currentFloor++;
    const nextFloor = content.getFloor(player.currentFloor);
    if (nextFloor) {
      player.currentRoomId = nextFloor.rooms[0].id;
      player.discoveredRooms.push(nextFloor.rooms[0].id);
      combatLog.push(`You advance to ${nextFloor.name}!`);
    }
  }

  enemyState = null;
  saveGame();
  k.go("room");
}

function handleDefeat(k: any, player: any) {
  // Revive at half HP, lose some crystals
  player.combatStats.currentHp = Math.floor(player.combatStats.maxHp / 2);
  player.combatStats.currentMana = Math.floor(player.combatStats.maxMana / 2);
  player.crystals = Math.max(0, player.crystals - 10);
  enemyState = null;
  saveGame();
  k.go("gameover");
}

function doRun(k: any, player: any) {
  const chance = 0.4 + player.combatStats.agility * 0.03;
  if (Math.random() < chance) {
    combatLog.push("You escaped!");
    enemyState = null;
    k.go("room");
  } else {
    combatLog.push("Couldn't escape!");
    enemyTurn(k, player, enemyState!);
  }
}

// ---- Spell selection sub-scene ----
export function combatSpellsScene(k: any, roomId: string) {
  const player = getPlayer();

  addCenteredText(k, "-- Spells --", 30, 24, [150, 150, 255]);

  let y = 70;
  player.spells.forEach((spellId) => {
    const spell = content.getSpell(spellId);
    if (!spell) return;

    const canCast = player.combatStats.currentMana >= spell.manaCost;
    const col: [number, number, number] = canCast ? [200, 200, 255] : [100, 100, 120];

    k.add([
      k.text(`${spell.name} (${spell.manaCost} MP) - ${spell.description}`, { size: 13, width: k.width() - 40 }),
      k.pos(20, y),
      k.color(col[0], col[1], col[2]),
      k.z(10),
    ]);

    if (canCast) {
      makeButton(k, {
        label: "Cast",
        x: k.width() - 60,
        y: y + 8,
        width: 80,
        height: 30,
        fontSize: 14,
        onClick: () => castSpell(k, player, spell, roomId),
      });
    }

    y += 45;
  });

  makeButton(k, {
    label: "Back",
    x: k.width() / 2,
    y: k.height() - 50,
    width: 140,
    height: 40,
    onClick: () => k.go("combat", roomId),
  });
}

function castSpell(k: any, player: any, spell: SpellDef, roomId: string) {
  if (!enemyState) return;

  player.combatStats.currentMana -= spell.manaCost;

  if (spell.damage < 0) {
    // Healing spell
    const heal = Math.abs(spell.damage);
    player.combatStats.currentHp = Math.min(player.combatStats.maxHp, player.combatStats.currentHp + heal);
    combatLog.push(`You cast ${spell.name}! Restored ${heal} HP!`);
  } else if (spell.effect === "defense_up") {
    playerDefenseBonus = 8;
    playerDefenseTurns = 3;
    combatLog.push(`You cast ${spell.name}! Defense increased for 3 turns!`);
  } else {
    const dmg = spell.damage + Math.floor(player.combatStats.power * 0.5);
    enemyState.currentHp -= dmg;
    combatLog.push(`You cast ${spell.name} for ${dmg} damage!`);
  }

  if (enemyState.currentHp <= 0) {
    enemyState.currentHp = 0;
    handleVictory(k, player, enemyState);
    return;
  }

  enemyTurn(k, player, enemyState);
}

// ---- Bag sub-scene for combat ----
export function combatBagScene(k: any, roomId: string) {
  const player = getPlayer();

  addCenteredText(k, "-- Bag --", 30, 24, [220, 200, 100]);

  let y = 70;
  const usableItems = player.inventory.filter((inv) => {
    const item = content.getItem(inv.id);
    return item && item.type === "consumable";
  });

  if (usableItems.length === 0) {
    addCenteredText(k, "No usable items.", 120, 16, [150, 150, 150]);
  }

  usableItems.forEach((inv) => {
    const item = content.getItem(inv.id);
    if (!item) return;

    k.add([
      k.text(`${item.name} x${inv.quantity} - ${item.description}`, { size: 13, width: k.width() - 120 }),
      k.pos(20, y),
      k.color(220, 220, 200),
      k.z(10),
    ]);

    makeButton(k, {
      label: "Use",
      x: k.width() - 60,
      y: y + 8,
      width: 80,
      height: 30,
      fontSize: 14,
      onClick: () => useItemInCombat(k, player, item, roomId),
    });

    y += 45;
  });

  makeButton(k, {
    label: "Back",
    x: k.width() / 2,
    y: k.height() - 50,
    width: 140,
    height: 40,
    onClick: () => k.go("combat", roomId),
  });
}

function useItemInCombat(k: any, player: any, item: any, roomId: string) {
  if (!removeItem(item.id)) return;

  if (item.effect === "heal_hp") {
    player.combatStats.currentHp = Math.min(player.combatStats.maxHp, player.combatStats.currentHp + item.value);
    combatLog.push(`Used ${item.name}! Restored ${item.value} HP!`);
  } else if (item.effect === "heal_mana") {
    player.combatStats.currentMana = Math.min(player.combatStats.maxMana, player.combatStats.currentMana + item.value);
    combatLog.push(`Used ${item.name}! Restored ${item.value} MP!`);
  }

  if (enemyState) {
    enemyTurn(k, player, enemyState);
  } else {
    k.go("combat", roomId);
  }
}
