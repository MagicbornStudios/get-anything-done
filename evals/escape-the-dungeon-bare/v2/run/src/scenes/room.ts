import { makeButton, addCenteredText, makeBar } from "../systems/ui";
import { getPlayer, saveGame, discoverRoom, addItem } from "../systems/state";
import { content } from "../systems/content";
import type { RoomDef } from "../types";

export function roomScene(k: any) {
  const player = getPlayer();
  const floor = content.getFloor(player.currentFloor);
  if (!floor) {
    addCenteredText(k, "You escaped the dungeon! Victory!", k.height() / 2, 36, [255, 220, 100]);
    makeButton(k, {
      label: "Return to Title",
      x: k.width() / 2,
      y: k.height() * 0.65,
      onClick: () => k.go("title"),
    });
    return;
  }

  const room = floor.rooms.find((r) => r.id === player.currentRoomId);
  if (!room) {
    addCenteredText(k, "Error: Room not found", k.height() / 2, 24, [255, 0, 0]);
    return;
  }

  // Discover adjacent rooms
  for (const targetId of Object.values(room.exits)) {
    discoverRoom(targetId);
  }

  // ---- HUD (top) ----
  drawHUD(k, player, floor.name);

  // ---- Room Info (center area) ----
  const roomTypeColors: Record<string, [number, number, number]> = {
    start: [100, 200, 100],
    combat: [220, 80, 80],
    dialogue: [100, 150, 220],
    treasure: [220, 200, 50],
    rest: [100, 220, 180],
    boss: [200, 50, 200],
    forge: [220, 140, 50],
  };
  const typeColor = roomTypeColors[room.type] ?? [200, 200, 200];

  // Room type badge
  addCenteredText(k, `[ ${room.type.toUpperCase()} ]`, 95, 16, typeColor);

  // Room name
  addCenteredText(k, room.name, 125, 28, [255, 255, 255]);

  // Room description
  addCenteredText(k, room.description, 165, 16, [180, 180, 200]);

  // ---- Room-type specific content ----
  let actionY = 210;

  if (room.type === "combat" || room.type === "boss") {
    handleCombatRoom(k, room, player, actionY);
  } else if (room.type === "dialogue") {
    handleDialogueRoom(k, room, actionY);
  } else if (room.type === "treasure") {
    handleTreasureRoom(k, room, player, actionY);
  } else if (room.type === "rest") {
    handleRestRoom(k, player, actionY);
  } else {
    // start room or generic
    addCenteredText(k, "Choose an exit to explore.", actionY, 16, [180, 180, 180]);
  }

  // ---- Navigation Exits (bottom) ----
  drawExits(k, room, player);

  // ---- Menu buttons (bottom row) ----
  drawMenuBar(k);

  saveGame();
}

function drawHUD(k: any, player: any, floorName: string) {
  // Background bar
  k.add([
    k.rect(k.width(), 80),
    k.pos(0, 0),
    k.color(20, 20, 40),
    k.z(20),
  ]);

  // Player name & level
  k.add([
    k.text(`${player.name} Lv.${player.level}`, { size: 16 }),
    k.pos(12, 8),
    k.color(255, 255, 255),
    k.z(21),
  ]);

  // Floor & tick
  k.add([
    k.text(`${floorName} | Tick: ${player.dungeonTick}`, { size: 14 }),
    k.pos(k.width() - 12, 8),
    k.anchor("topright"),
    k.color(180, 180, 200),
    k.z(21),
  ]);

  // HP bar
  k.add([
    k.text("HP", { size: 12 }),
    k.pos(12, 34),
    k.color(255, 100, 100),
    k.z(21),
  ]);
  makeBar(k, 36, 37, 180, 14, player.combatStats.currentHp, player.combatStats.maxHp, [200, 50, 50]);
  k.add([
    k.text(`${player.combatStats.currentHp}/${player.combatStats.maxHp}`, { size: 11 }),
    k.pos(220, 34),
    k.color(255, 200, 200),
    k.z(21),
  ]);

  // Mana bar
  k.add([
    k.text("MP", { size: 12 }),
    k.pos(12, 56),
    k.color(100, 100, 255),
    k.z(21),
  ]);
  makeBar(k, 36, 59, 180, 14, player.combatStats.currentMana, player.combatStats.maxMana, [50, 50, 200]);
  k.add([
    k.text(`${player.combatStats.currentMana}/${player.combatStats.maxMana}`, { size: 11 }),
    k.pos(220, 56),
    k.color(200, 200, 255),
    k.z(21),
  ]);

  // Crystals
  k.add([
    k.text(`Crystals: ${player.crystals}`, { size: 13 }),
    k.pos(k.width() - 12, 40),
    k.anchor("topright"),
    k.color(220, 200, 50),
    k.z(21),
  ]);

  // XP
  k.add([
    k.text(`XP: ${player.xp}/${player.xpToNext}`, { size: 13 }),
    k.pos(k.width() - 12, 58),
    k.anchor("topright"),
    k.color(150, 220, 150),
    k.z(21),
  ]);
}

function handleCombatRoom(k: any, room: RoomDef, player: any, y: number) {
  const enemyId = room.enemyId;
  if (!enemyId) return;

  // Check if already defeated
  if (player.defeatedEnemies.includes(room.id)) {
    addCenteredText(k, "The enemy here has been defeated.", y, 16, [120, 200, 120]);
    return;
  }

  const enemy = content.getEnemy(enemyId);
  if (!enemy) return;

  const entityType = content.getEntityType(enemy.entityType);
  const col = entityType?.spriteColor ?? [200, 200, 200];

  // Enemy sprite placeholder
  k.add([
    k.rect(60, 60, { radius: 8 }),
    k.pos(k.width() / 2, y + 10),
    k.color(col[0], col[1], col[2]),
    k.anchor("center"),
    k.z(10),
  ]);

  addCenteredText(k, `${enemy.name} (Lv.${enemy.level})`, y + 55, 18, [255, 200, 200]);
  addCenteredText(k, `HP: ${enemy.stats.maxHp} | ATK: ${enemy.stats.might} | DEF: ${enemy.stats.defense}`, y + 78, 14, [200, 180, 180]);

  makeButton(k, {
    label: "Fight!",
    x: k.width() / 2,
    y: y + 115,
    width: 160,
    height: 44,
    fontSize: 20,
    onClick: () => k.go("combat", room.id),
  });
}

function handleDialogueRoom(k: any, room: RoomDef, y: number) {
  const npcId = room.npcId;
  if (!npcId) return;

  const npc = content.getNpc(npcId);
  if (!npc) return;

  // NPC sprite placeholder
  const entityType = content.getEntityType(npc.entityType);
  const col = entityType?.spriteColor ?? [200, 200, 200];

  k.add([
    k.rect(50, 50, { radius: 25 }),
    k.pos(k.width() / 2, y + 10),
    k.color(col[0], col[1], col[2]),
    k.anchor("center"),
    k.z(10),
  ]);

  addCenteredText(k, npc.name, y + 50, 20, [150, 200, 255]);

  makeButton(k, {
    label: "Talk",
    x: k.width() / 2,
    y: y + 85,
    width: 160,
    height: 40,
    onClick: () => k.go("dialogue", room.npcId),
  });
}

function handleTreasureRoom(k: any, room: RoomDef, player: any, y: number) {
  if (!room.loot) return;

  // Check if already looted (simple: use defeatedEnemies array for any "completed" room)
  if (player.defeatedEnemies.includes(room.id)) {
    addCenteredText(k, "The chest has already been opened.", y, 16, [120, 180, 120]);
    return;
  }

  // Treasure chest icon
  k.add([
    k.rect(50, 40, { radius: 4 }),
    k.pos(k.width() / 2, y + 10),
    k.color(220, 200, 50),
    k.anchor("center"),
    k.z(10),
  ]);

  addCenteredText(k, "A treasure chest!", y + 45, 18, [220, 200, 50]);

  makeButton(k, {
    label: "Open Chest",
    x: k.width() / 2,
    y: y + 80,
    width: 180,
    height: 40,
    onClick: () => {
      player.crystals += room.loot!.crystals;
      if (room.loot!.item) {
        addItem(room.loot!.item);
      }
      player.defeatedEnemies.push(room.id);
      saveGame();
      k.go("room"); // refresh
    },
  });
}

function handleRestRoom(k: any, player: any, y: number) {
  addCenteredText(k, "A safe place to rest.", y, 16, [100, 220, 180]);

  makeButton(k, {
    label: "Rest (Restore HP & MP)",
    x: k.width() / 2,
    y: y + 40,
    width: 240,
    height: 44,
    onClick: () => {
      player.combatStats.currentHp = player.combatStats.maxHp;
      player.combatStats.currentMana = player.combatStats.maxMana;
      saveGame();
      k.go("room"); // refresh
    },
  });
}

function drawExits(k: any, room: RoomDef, player: any) {
  const exits = Object.entries(room.exits);
  const startY = k.height() - 160;
  const dirLabels: Record<string, string> = {
    north: "North",
    south: "South",
    east: "East",
    west: "West",
    up: "Up",
    down: "Down",
  };

  // Section header
  addCenteredText(k, "-- Exits --", startY - 20, 14, [140, 140, 160]);

  const buttonWidth = 180;
  const cols = Math.min(exits.length, 3);
  const spacing = 190;
  const totalWidth = cols * spacing;
  const offsetX = (k.width() - totalWidth) / 2 + spacing / 2;

  exits.forEach(([dir, targetId], i) => {
    const targetRoom = content.getRoom(player.currentFloor, targetId);
    const roomLabel = targetRoom ? targetRoom.name : "???";
    const typeHint = targetRoom ? ` (${targetRoom.type})` : "";

    const col = i % 3;
    const row = Math.floor(i / 3);

    makeButton(k, {
      label: `${dirLabels[dir] ?? dir}: ${roomLabel}${typeHint}`,
      x: offsetX + col * spacing,
      y: startY + row * 50,
      width: buttonWidth,
      height: 38,
      fontSize: 12,
      onClick: () => {
        player.currentRoomId = targetId;
        player.dungeonTick++;
        discoverRoom(targetId);
        saveGame();
        k.go("room");
      },
    });
  });
}

function drawMenuBar(k: any) {
  const menus = ["Stats", "Bag", "Map"];
  const y = k.height() - 35;
  const btnW = 80;
  const spacing = 90;
  const totalW = menus.length * spacing;
  const startX = (k.width() - totalW) / 2 + spacing / 2;

  menus.forEach((label, i) => {
    makeButton(k, {
      label,
      x: startX + i * spacing,
      y,
      width: btnW,
      height: 30,
      fontSize: 14,
      onClick: () => k.go(label.toLowerCase()),
    });
  });
}
