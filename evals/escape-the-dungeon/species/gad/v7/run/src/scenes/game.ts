import type { KAPLAYCtx } from "kaplay";
import {
  getGameState,
  getCurrentLevel,
  getCurrentRoom,
  moveToRoom,
  discoverRoom,
  isRoomDiscovered,
  getEntityById,
  restAtRoom,
  searchRoom,
  saveGame,
} from "../systems/gameState";
import type { Room, RoomFeature } from "../types";

const ROOM_COLORS: Record<RoomFeature, [number, number, number]> = {
  corridor: [50, 50, 70],
  start: [40, 70, 40],
  exit: [120, 40, 40],
  stairs_up: [60, 80, 60],
  stairs_down: [60, 80, 60],
  escape_gate: [80, 80, 40],
  training: [60, 60, 40],
  dialogue: [40, 60, 80],
  rest: [40, 80, 70],
  treasure: [80, 70, 30],
  rune_forge: [80, 40, 60],
  combat: [90, 35, 35],
};

const ROOM_ICONS: Record<RoomFeature, string> = {
  corridor: "~",
  start: "S",
  exit: "B",
  stairs_up: "^",
  stairs_down: "v",
  escape_gate: "!",
  training: "T",
  dialogue: "?",
  rest: "+",
  treasure: "$",
  rune_forge: "R",
  combat: "!",
};

export function loadGameScene(k: KAPLAYCtx) {
  k.scene("game", () => {
    const state = getGameState();
    const level = getCurrentLevel();
    const room = getCurrentRoom();

    if (!level || !room) {
      k.go("mainMenu");
      return;
    }

    // Discover starting room
    discoverRoom(state.player.currentDepth, state.player.currentRoomId);

    // === BACKGROUND ===
    const bgColor = getRoomBgColor(room.feature);
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(bgColor[0], bgColor[1], bgColor[2])]);

    // === TOP HEADER BAR ===
    k.add([k.rect(k.width(), 50), k.pos(0, 0), k.color(15, 15, 30)]);

    // Floor info
    k.add([
      k.text(`Floor ${state.player.currentDepth} - Tick ${state.player.dungeonTick}`, { size: 16 }),
      k.pos(15, 15),
      k.color(200, 200, 220),
    ]);

    // HP bar
    const hpRatio = state.player.combatStats.currentHp / state.player.combatStats.maxHp;
    k.add([k.rect(120, 14, { radius: 3 }), k.pos(250, 18), k.color(40, 20, 20)]);
    k.add([k.rect(120 * hpRatio, 14, { radius: 3 }), k.pos(250, 18), k.color(80, 200, 80)]);
    k.add([
      k.text(`HP ${state.player.combatStats.currentHp}/${state.player.combatStats.maxHp}`, { size: 11 }),
      k.pos(255, 19),
      k.color(255, 255, 255),
    ]);

    // Mana bar
    const manaRatio = state.player.combatStats.currentMana / state.player.combatStats.maxMana;
    k.add([k.rect(120, 14, { radius: 3 }), k.pos(390, 18), k.color(20, 20, 40)]);
    k.add([k.rect(120 * manaRatio, 14, { radius: 3 }), k.pos(390, 18), k.color(80, 80, 200)]);
    k.add([
      k.text(`MP ${state.player.combatStats.currentMana}/${state.player.combatStats.maxMana}`, { size: 11 }),
      k.pos(395, 19),
      k.color(255, 255, 255),
    ]);

    // Level and crystals
    k.add([
      k.text(`Lv.${state.player.level}`, { size: 14 }),
      k.pos(530, 17),
      k.color(255, 215, 0),
    ]);

    k.add([
      k.text(`${state.player.manaCrystals} crystals`, { size: 14 }),
      k.pos(600, 17),
      k.color(180, 200, 255),
    ]);

    // Save button
    const saveBtn = k.add([
      k.rect(60, 28, { radius: 4 }),
      k.pos(k.width() - 80, 11),
      k.color(40, 50, 60),
      k.area(),
    ]);
    k.add([
      k.text("Save", { size: 13 }),
      k.pos(k.width() - 50, 25),
      k.anchor("center"),
      k.color(180, 200, 220),
    ]);
    saveBtn.onClick(() => {
      saveGame();
    });

    // === FLOOR MAP (center area) ===
    const mapX = 40;
    const mapY = 65;
    const mapW = 750;
    const mapH = 400;

    // Map background
    k.add([k.rect(mapW, mapH, { radius: 8 }), k.pos(mapX, mapY), k.color(12, 12, 24)]);

    // Map title
    k.add([
      k.text(`Floor ${state.player.currentDepth} Map`, { size: 14 }),
      k.pos(mapX + 10, mapY + 8),
      k.color(120, 120, 160),
    ]);

    // Render rooms on map
    const layout = level.mapLayout;
    if (layout) {
      // Calculate grid bounds
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const pos of Object.values(layout)) {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      }

      const gridW = maxX - minX + 1;
      const gridH = maxY - minY + 1;
      const cellW = Math.min(100, (mapW - 60) / gridW);
      const cellH = Math.min(80, (mapH - 60) / gridH);
      const offsetX = mapX + (mapW - gridW * cellW) / 2;
      const offsetY = mapY + 30 + (mapH - 30 - gridH * cellH) / 2;

      // Draw connections first
      for (const r of level.rooms) {
        const fromPos = layout[r.roomId];
        if (!fromPos) continue;
        const fx = offsetX + (fromPos.x - minX) * cellW + cellW / 2;
        const fy = offsetY + (fromPos.y - minY) * cellH + cellH / 2;

        for (const exit of r.exits) {
          const toPos = layout[exit.targetRoomId];
          if (!toPos) continue;
          const tx = offsetX + (toPos.x - minX) * cellW + cellW / 2;
          const ty = offsetY + (toPos.y - minY) * cellH + cellH / 2;

          // Draw line
          const dx = tx - fx;
          const dy = ty - fy;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) continue;

          k.add([
            k.rect(len, 2),
            k.pos(fx, fy),
            k.anchor("left"),
            k.rotate(Math.atan2(dy, dx) * (180 / Math.PI)),
            k.color(40, 40, 60),
          ]);
        }
      }

      // Draw rooms
      for (const r of level.rooms) {
        const pos = layout[r.roomId];
        if (!pos) continue;

        const rx = offsetX + (pos.x - minX) * cellW;
        const ry = offsetY + (pos.y - minY) * cellH;
        const rw = cellW - 8;
        const rh = cellH - 8;
        const discovered = isRoomDiscovered(state.player.currentDepth, r.roomId);
        const isCurrent = r.roomId === state.player.currentRoomId;
        const isAdjacent = room.exits.some((e) => e.targetRoomId === r.roomId);

        let color: [number, number, number];
        if (isCurrent) {
          color = [80, 180, 80]; // green for current
        } else if (!discovered && r.feature === "exit") {
          color = [60, 20, 20]; // dark red for undiscovered boss
        } else if (!discovered) {
          color = [25, 25, 35]; // dark for undiscovered
        } else if (isAdjacent) {
          const base = ROOM_COLORS[r.feature] || [50, 50, 70];
          color = [base[0] + 15, base[1] + 15, base[2] + 15];
        } else {
          color = ROOM_COLORS[r.feature] || [50, 50, 70];
        }

        // Room rect
        const roomRect = k.add([
          k.rect(rw, rh, { radius: 6 }),
          k.pos(rx + 4, ry + 4),
          k.color(color[0], color[1], color[2]),
          ...(isAdjacent && !isCurrent ? [k.area()] : []),
        ]);

        // Border for special rooms
        if (isCurrent) {
          k.add([
            k.rect(rw + 4, rh + 4, { radius: 8 }),
            k.pos(rx + 2, ry + 2),
            k.color(100, 255, 100),
            k.outline(2),
            k.z(-1),
          ]);
        } else if (r.feature === "exit") {
          k.add([
            k.rect(rw + 4, rh + 4, { radius: 8 }),
            k.pos(rx + 2, ry + 2),
            k.color(200, 50, 50),
            k.outline(2),
            k.z(-1),
          ]);
        }

        // Room icon
        const icon = discovered || r.feature === "exit" ? ROOM_ICONS[r.feature] : "?";
        k.add([
          k.text(icon, { size: 20 }),
          k.pos(rx + 4 + rw / 2, ry + 4 + rh / 2 - 6),
          k.anchor("center"),
          k.color(isCurrent ? 255 : discovered ? 200 : 80, isCurrent ? 255 : discovered ? 200 : 80, discovered || isCurrent ? 220 : 100),
        ]);

        // Room name (small, if discovered)
        if (discovered || isCurrent) {
          const shortName = r.name.length > 12 ? r.name.substring(0, 11) + ".." : r.name;
          k.add([
            k.text(shortName, { size: 9 }),
            k.pos(rx + 4 + rw / 2, ry + 4 + rh - 10),
            k.anchor("center"),
            k.color(160, 160, 180),
          ]);
        }

        // Click handler for adjacent rooms
        if (isAdjacent && !isCurrent) {
          roomRect.onClick(() => {
            handleMove(k, r.roomId);
          });

          roomRect.onHover(() => {
            roomRect.color = k.rgb(
              Math.min(255, color[0] + 25),
              Math.min(255, color[1] + 25),
              Math.min(255, color[2] + 25)
            );
          });

          roomRect.onHoverEnd(() => {
            roomRect.color = k.rgb(color[0], color[1], color[2]);
          });
        }
      }
    }

    // === RIGHT PANEL: Room Info + Actions ===
    const panelX = 810;
    const panelY = 65;
    const panelW = 440;

    // Room info box
    k.add([k.rect(panelW, 180, { radius: 8 }), k.pos(panelX, panelY), k.color(18, 18, 32)]);

    k.add([
      k.text(room.name, { size: 20 }),
      k.pos(panelX + 15, panelY + 12),
      k.color(255, 215, 0),
    ]);

    // Room feature badge
    const featureLabel = room.feature.replace(/_/g, " ").toUpperCase();
    k.add([
      k.text(featureLabel, { size: 11 }),
      k.pos(panelX + 15, panelY + 38),
      k.color(...(ROOM_COLORS[room.feature] || [100, 100, 100]).map((c) => Math.min(255, c + 80)) as [number, number, number]),
    ]);

    k.add([
      k.text(room.description, { size: 13, width: panelW - 30 }),
      k.pos(panelX + 15, panelY + 58),
      k.color(170, 170, 190),
    ]);

    // === Room Actions ===
    const actionY = panelY + 200;
    k.add([k.rect(panelW, 260, { radius: 8 }), k.pos(panelX, actionY), k.color(18, 18, 32)]);

    k.add([
      k.text("Actions", { size: 16 }),
      k.pos(panelX + 15, actionY + 10),
      k.color(160, 160, 200),
    ]);

    let btnY = actionY + 38;
    const btnW = panelW - 30;
    const btnH = 36;
    const btnGap = 42;

    // Movement exits
    k.add([
      k.text("Exits:", { size: 13 }),
      k.pos(panelX + 15, btnY),
      k.color(120, 120, 150),
    ]);
    btnY += 22;

    for (const exit of room.exits) {
      const exitBtn = k.add([
        k.rect(btnW, btnH, { radius: 6 }),
        k.pos(panelX + 15, btnY),
        k.color(35, 45, 55),
        k.area(),
      ]);

      const targetRoom = level.rooms.find((r) => r.roomId === exit.targetRoomId);
      const dirLabel = exit.direction.charAt(0).toUpperCase() + exit.direction.slice(1);
      const roomLabel = targetRoom ? ` - ${targetRoom.name}` : "";

      k.add([
        k.text(`${dirLabel}${roomLabel}`, { size: 13 }),
        k.pos(panelX + 25, btnY + btnH / 2),
        k.anchor("left"),
        k.color(180, 200, 220),
      ]);

      exitBtn.onClick(() => {
        handleMove(k, exit.targetRoomId);
      });

      exitBtn.onHover(() => { exitBtn.color = k.rgb(50, 65, 80); });
      exitBtn.onHoverEnd(() => { exitBtn.color = k.rgb(35, 45, 55); });

      btnY += btnGap;
    }

    // Room-specific actions
    btnY += 5;
    addRoomActions(k, room, panelX + 15, btnY, btnW, btnH);

    // === BOTTOM STATUS BAR ===
    const statusY = k.height() - 40;
    k.add([k.rect(k.width(), 40), k.pos(0, statusY), k.color(15, 15, 30)]);

    k.add([
      k.text(`XP: ${state.player.xp}/${state.player.xpToNext}  |  Fame: ${state.player.fame}  |  ${state.player.name} the Dungeoneer`, { size: 13 }),
      k.pos(15, statusY + 13),
      k.color(140, 140, 170),
    ]);
  });
}

function getRoomBgColor(feature: RoomFeature): [number, number, number] {
  switch (feature) {
    case "combat": return [25, 15, 15];
    case "rest": return [15, 25, 25];
    case "rune_forge": return [25, 18, 12];
    case "treasure": return [25, 22, 12];
    case "dialogue": return [15, 18, 25];
    case "exit": return [30, 15, 15];
    default: return [18, 18, 28];
  }
}

function handleMove(k: KAPLAYCtx, targetRoomId: string) {
  const result = moveToRoom(targetRoomId);
  if (!result) return;

  const { room, entities } = result;
  const state = getGameState();

  // Check for hostile entities
  const hostile = entities.find((e) => e.occupationId === "hostile" || e.occupationId === "boss");
  if (hostile) {
    // Deep copy enemy so combat doesn't modify the content data
    state.currentEnemy = JSON.parse(JSON.stringify(hostile));
    state.isInCombat = true;
    k.go("combat");
    return;
  }

  // Auto-enter dialogue for dialogue rooms
  const npc = entities.find((e) => e.occupationId === "dungeoneer");
  if (room.feature === "dialogue" && npc) {
    state.currentDialogueNpc = npc;
    k.go("dialogue");
    return;
  }

  // Otherwise just refresh the game scene
  k.go("game");
}

function addRoomActions(k: KAPLAYCtx, room: Room, x: number, y: number, w: number, h: number) {
  const state = getGameState();

  switch (room.feature) {
    case "rest": {
      const restBtn = k.add([
        k.rect(w, h, { radius: 6 }),
        k.pos(x, y),
        k.color(40, 80, 70),
        k.area(),
      ]);
      k.add([
        k.text("Rest (restore HP/MP, +1 tick)", { size: 13 }),
        k.pos(x + 10, y + h / 2),
        k.anchor("left"),
        k.color(200, 255, 240),
      ]);
      restBtn.onClick(() => {
        restAtRoom();
        k.go("game");
      });
      break;
    }

    case "treasure": {
      if (room.treasureChestRef) {
        const searchBtn = k.add([
          k.rect(w, h, { radius: 6 }),
          k.pos(x, y),
          k.color(80, 70, 30),
          k.area(),
        ]);
        k.add([
          k.text("Search treasure chest", { size: 13 }),
          k.pos(x + 10, y + h / 2),
          k.anchor("left"),
          k.color(255, 230, 150),
        ]);
        searchBtn.onClick(() => {
          searchRoom();
          k.go("game");
        });
      } else {
        k.add([
          k.text("(Already searched)", { size: 12 }),
          k.pos(x + 10, y + h / 2),
          k.anchor("left"),
          k.color(100, 100, 120),
        ]);
      }
      break;
    }

    case "rune_forge": {
      const forgeBtn = k.add([
        k.rect(w, h, { radius: 6 }),
        k.pos(x, y),
        k.color(80, 40, 60),
        k.area(),
      ]);
      k.add([
        k.text("Open Rune Forge", { size: 13 }),
        k.pos(x + 10, y + h / 2),
        k.anchor("left"),
        k.color(255, 200, 230),
      ]);
      forgeBtn.onClick(() => {
        k.go("runeForge");
      });
      break;
    }

    case "dialogue": {
      const entities = (room.entities || []).map((eid) => getEntityById(eid)).filter(Boolean);
      const npc = entities.find((e) => e && e.occupationId === "dungeoneer");
      if (npc) {
        const talkBtn = k.add([
          k.rect(w, h, { radius: 6 }),
          k.pos(x, y),
          k.color(40, 60, 80),
          k.area(),
        ]);
        k.add([
          k.text(`Talk to ${npc.name}`, { size: 13 }),
          k.pos(x + 10, y + h / 2),
          k.anchor("left"),
          k.color(200, 220, 255),
        ]);
        talkBtn.onClick(() => {
          state.currentDialogueNpc = npc;
          k.go("dialogue");
        });
      }
      break;
    }

    case "combat":
    case "exit": {
      const entities = (room.entities || []).map((eid) => getEntityById(eid)).filter(Boolean);
      const hostile = entities.find((e) => e && (e.occupationId === "hostile" || e.occupationId === "boss"));
      if (hostile) {
        const fightBtn = k.add([
          k.rect(w, h, { radius: 6 }),
          k.pos(x, y),
          k.color(90, 35, 35),
          k.area(),
        ]);
        k.add([
          k.text(`Fight ${hostile.name}`, { size: 13 }),
          k.pos(x + 10, y + h / 2),
          k.anchor("left"),
          k.color(255, 180, 180),
        ]);
        fightBtn.onClick(() => {
          state.currentEnemy = JSON.parse(JSON.stringify(hostile));
          state.isInCombat = true;
          k.go("combat");
        });
      }
      break;
    }
  }
}
