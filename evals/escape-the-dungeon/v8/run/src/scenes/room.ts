// Room navigation scene
import type { KAPLAYCtx } from "kaplay";
import {
  getPlayer, getCurrentFloor, getCurrentRoom, moveToRoom,
  saveGame, healPlayer, addItem, markRoomCleared, nextFloor,
} from "../systems/gamestate";
import { ROOM_THEMES, DIRECTION_LABELS } from "../systems/draw";
import { ITEMS } from "../data/content";
import { drawHUD } from "./hud";

export function roomScene(k: KAPLAYCtx) {
  const W = k.width();
  const H = k.height();
  const player = getPlayer();
  const floor = getCurrentFloor();
  const room = getCurrentRoom();

  if (!room) {
    k.go("title");
    return;
  }

  const theme = ROOM_THEMES[room.type];

  // Background
  k.add([
    k.rect(W, H),
    k.pos(0, 0),
    k.color(k.Color.fromHex(theme.bg)),
  ]);

  // Top panel border accent
  k.add([
    k.rect(W, 3),
    k.pos(0, 0),
    k.color(k.Color.fromHex(theme.accent)),
  ]);

  // HUD at top
  drawHUD(k, player);

  // Room type icon and name panel
  const panelY = 65;
  k.add([
    k.rect(W - 40, 80, { radius: 10 }),
    k.pos(20, panelY),
    k.color(20, 22, 40),
    k.outline(2, k.Color.fromHex(theme.accent)),
  ]);

  // Room type icon (large)
  k.add([
    k.text(theme.icon, { size: 36 }),
    k.pos(50, panelY + 20),
  ]);

  // Room name
  k.add([
    k.text(room.name, { size: 24, font: "monospace" }),
    k.pos(95, panelY + 10),
    k.color(220, 220, 240),
  ]);

  // Room type label
  k.add([
    k.text(theme.label.toUpperCase(), { size: 12, font: "monospace" }),
    k.pos(95, panelY + 40),
    k.color(k.Color.fromHex(theme.accent)),
  ]);

  // Floor and tick info
  k.add([
    k.text(`Floor ${player.currentFloor}  |  Tick ${player.tick}`, { size: 12, font: "monospace" }),
    k.pos(W - 200, panelY + 45),
    k.color(140, 145, 170),
  ]);

  // Room description panel
  const descY = panelY + 95;
  k.add([
    k.rect(W - 40, 60, { radius: 8 }),
    k.pos(20, descY),
    k.color(25, 28, 48),
    k.outline(1, k.Color.fromArray([50, 55, 80])),
  ]);

  k.add([
    k.text(room.description, { size: 14, font: "monospace", width: W - 80 }),
    k.pos(35, descY + 12),
    k.color(180, 185, 200),
  ]);

  // Handle room type interactions
  const actionY = descY + 80;

  if (room.type === "combat" && !room.cleared && room.enemyId) {
    // Show combat encounter button
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, actionY),
      k.color(40, 15, 15),
      k.outline(2, k.Color.fromArray([180, 50, 50])),
    ]);
    k.add([
      k.text(`\u{2694}\u{FE0F} Enemy lurking! Prepare for battle!`, { size: 16, font: "monospace" }),
      k.pos(40, actionY + 16),
      k.color(220, 80, 80),
    ]);

    makeActionButton(k, W / 2, actionY + 70, 200, 44, "\u{2694}\u{FE0F} Fight!", () => {
      k.go("combat", room.enemyId);
    }, "#cc3333");
  } else if (room.type === "boss" && !room.cleared && room.enemyId) {
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, actionY),
      k.color(50, 10, 10),
      k.outline(2, k.Color.fromArray([255, 60, 60])),
    ]);
    k.add([
      k.text(`\u{1F480} A powerful guardian blocks the way!`, { size: 16, font: "monospace" }),
      k.pos(40, actionY + 16),
      k.color(255, 80, 80),
    ]);
    makeActionButton(k, W / 2, actionY + 70, 240, 44, "\u{1F480} Challenge Boss!", () => {
      k.go("combat", room.enemyId);
    }, "#ff4444");
  } else if (room.type === "forge") {
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, actionY),
      k.color(30, 15, 35),
      k.outline(2, k.Color.fromArray([160, 60, 200])),
    ]);
    k.add([
      k.text(`\u{2728} The Rune Forge pulses with arcane energy`, { size: 16, font: "monospace" }),
      k.pos(40, actionY + 16),
      k.color(180, 120, 220),
    ]);
    makeActionButton(k, W / 2, actionY + 70, 240, 44, "\u{2728} Enter Forge", () => {
      k.go("forge");
    }, "#aa33cc");
    if (!room.cleared) {
      markRoomCleared(room.id);
    }
  } else if (room.type === "dialogue" && !room.cleared && room.npcId) {
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, actionY),
      k.color(15, 30, 15),
      k.outline(2, k.Color.fromArray([60, 160, 80])),
    ]);
    k.add([
      k.text(`\u{1F4AC} Someone is here...`, { size: 16, font: "monospace" }),
      k.pos(40, actionY + 16),
      k.color(100, 200, 120),
    ]);
    makeActionButton(k, W / 2, actionY + 70, 200, 44, "\u{1F4AC} Talk", () => {
      k.go("dialogue", room.npcId);
    }, "#33aa55");
  } else if (room.type === "treasure" && !room.cleared && room.loot) {
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, actionY),
      k.color(30, 30, 15),
      k.outline(2, k.Color.fromArray([180, 160, 50])),
    ]);
    const lootNames = room.loot.map(id => ITEMS[id]?.name ?? id).join(", ");
    k.add([
      k.text(`\u{1F4E6} You found: ${lootNames}`, { size: 16, font: "monospace" }),
      k.pos(40, actionY + 16),
      k.color(220, 200, 80),
    ]);
    makeActionButton(k, W / 2, actionY + 70, 200, 44, "\u{1F4E6} Collect Loot", () => {
      for (const itemId of room.loot!) {
        addItem(itemId);
      }
      markRoomCleared(room.id);
      saveGame();
      k.go("room");
    }, "#ccaa33");
  } else if (room.type === "rest" && !room.cleared) {
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, actionY),
      k.color(15, 15, 30),
      k.outline(2, k.Color.fromArray([60, 100, 200])),
    ]);
    k.add([
      k.text(`\u{1F6CF}\u{FE0F} A place of respite. Rest here to recover.`, { size: 16, font: "monospace" }),
      k.pos(40, actionY + 16),
      k.color(100, 150, 220),
    ]);
    makeActionButton(k, W / 2, actionY + 70, 200, 44, "\u{1F6CF}\u{FE0F} Rest", () => {
      healPlayer(Math.floor(player.stats.maxHp * 0.4), Math.floor(player.stats.maxMana * 0.3));
      markRoomCleared(room.id);
      saveGame();
      k.go("room");
    }, "#3366cc");
  } else if (room.type === "boss" && room.cleared) {
    // Boss cleared - allow going to next floor
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, actionY),
      k.color(15, 30, 15),
      k.outline(2, k.Color.fromArray([80, 200, 80])),
    ]);
    k.add([
      k.text(`\u{2705} The guardian is defeated! A stairway appears.`, { size: 16, font: "monospace" }),
      k.pos(40, actionY + 16),
      k.color(80, 220, 80),
    ]);
    makeActionButton(k, W / 2, actionY + 70, 240, 44, "\u{1F4AA} Descend to Next Floor", () => {
      nextFloor();
      saveGame();
      k.go("room");
    }, "#44aa44");
  } else {
    // Room cleared or no special action
    k.add([
      k.rect(W - 40, 36, { radius: 8 }),
      k.pos(20, actionY),
      k.color(25, 28, 42),
      k.outline(1, k.Color.fromArray([50, 55, 80])),
    ]);
    k.add([
      k.text(`\u{2705} This room has been explored.`, { size: 14, font: "monospace" }),
      k.pos(40, actionY + 10),
      k.color(100, 160, 100),
    ]);
    // Still allow entering forge even if "cleared"
    if ((room.type as string) === "forge") {
      makeActionButton(k, W / 2, actionY + 55, 240, 40, "\u{2728} Enter Forge", () => {
        k.go("forge");
      }, "#aa33cc");
    }
  }

  // Navigation exits panel
  const exitsY = H - 180;
  k.add([
    k.rect(W - 40, 4),
    k.pos(20, exitsY - 10),
    k.color(40, 45, 70),
  ]);

  k.add([
    k.text("EXITS", { size: 14, font: "monospace" }),
    k.pos(30, exitsY),
    k.color(140, 145, 170),
  ]);

  const exits = Object.entries(room.exits);
  const btnWidth = Math.min(200, (W - 60) / Math.max(exits.length, 1) - 10);

  exits.forEach(([dir, targetId], i) => {
    const targetRoom = floor.rooms[targetId];
    const targetTheme = targetRoom ? ROOM_THEMES[targetRoom.type] : ROOM_THEMES.combat;
    const discovered = targetRoom?.discovered;

    const label = discovered
      ? `${DIRECTION_LABELS[dir] ?? dir}\n${targetTheme.icon} ${targetRoom?.name ?? "Unknown"}`
      : `${DIRECTION_LABELS[dir] ?? dir}\n\u{2753} Unknown`;

    const bx = 30 + i * (btnWidth + 10) + btnWidth / 2;
    const by = exitsY + 55;

    const btnColor = discovered ? targetTheme.accent : "#445566";

    makeActionButton(k, bx, by, btnWidth, 52, label, () => {
      moveToRoom(targetId);
      saveGame();

      const tRoom = getCurrentRoom();
      if (tRoom) {
        // Auto-enter combat/boss rooms
        if ((tRoom.type === "combat" || tRoom.type === "boss") && !tRoom.cleared && tRoom.enemyId) {
          k.go("room");
        } else if (tRoom.type === "dialogue" && !tRoom.cleared && tRoom.npcId) {
          k.go("room");
        } else {
          k.go("room");
        }
      } else {
        k.go("room");
      }
    }, btnColor);
  });

  // Menu buttons row at bottom
  const menuY = H - 35;
  makeMenuButton(k, 60, menuY, "\u{1F5FA}\u{FE0F} Map", () => {
    k.go("room"); // TODO: map overlay
  });
  makeMenuButton(k, 180, menuY, "\u{1F4DA} Spells", () => {
    k.go("room"); // TODO: spellbook overlay
  });
  makeMenuButton(k, 300, menuY, "\u{1F392} Bag", () => {
    k.go("room"); // TODO: bag overlay
  });
}

function makeActionButton(
  k: KAPLAYCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  action: () => void,
  accentColor: string,
) {
  const bg = k.add([
    k.rect(w, h, { radius: 6 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(25, 30, 50),
    k.outline(2, k.Color.fromHex(accentColor)),
    k.area(),
    "action-btn",
  ]);

  k.add([
    k.text(label, { size: 13, font: "monospace", width: w - 16, align: "center" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(220, 220, 240),
  ]);

  bg.onHoverUpdate(() => {
    bg.color = k.Color.fromHex(accentColor);
    bg.color = bg.color.darken(150);
    k.setCursor("pointer");
  });
  bg.onHoverEnd(() => {
    bg.color = k.Color.fromArray([25, 30, 50]);
    k.setCursor("default");
  });
  bg.onClick(action);

  return bg;
}

function makeMenuButton(
  k: KAPLAYCtx,
  x: number,
  y: number,
  label: string,
  action: () => void,
) {
  const bg = k.add([
    k.rect(100, 28, { radius: 4 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(20, 24, 40),
    k.outline(1, k.Color.fromArray([60, 65, 90])),
    k.area(),
    "menu-btn",
  ]);

  k.add([
    k.text(label, { size: 11, font: "monospace" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(160, 165, 190),
  ]);

  bg.onHoverUpdate(() => {
    bg.color = k.Color.fromArray([35, 40, 60]);
    k.setCursor("pointer");
  });
  bg.onHoverEnd(() => {
    bg.color = k.Color.fromArray([20, 24, 40]);
    k.setCursor("default");
  });
  bg.onClick(action);

  return bg;
}
