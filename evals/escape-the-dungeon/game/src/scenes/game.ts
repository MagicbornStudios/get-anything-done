import type { KAPLAYCtx } from "kaplay";
import {
  getGameState,
  getCurrentLevel,
  getCurrentRoom,
  getEntityById,
  moveToRoom,
  moveToNextFloor,
  restAtRoom,
  searchRoom,
  discoverRoom,
  isRoomDiscovered,
  saveGame,
  useItem,
} from "../systems/gameState";
import { DUNGEON } from "../content/dungeon";
import type { Room, RoomFeature, EntityDefinition, InventoryItem } from "../types";

// Room feature colors
const FEATURE_COLORS: Record<RoomFeature, [number, number, number]> = {
  corridor: [80, 80, 100],
  start: [60, 120, 60],
  exit: [180, 50, 50],
  stairs_up: [100, 150, 100],
  stairs_down: [100, 150, 100],
  escape_gate: [255, 215, 0],
  training: [100, 100, 180],
  dialogue: [80, 140, 180],
  rest: [60, 160, 120],
  treasure: [180, 160, 40],
  rune_forge: [160, 80, 200],
  combat: [180, 60, 60],
};

const FEATURE_ICONS: Record<RoomFeature, string> = {
  corridor: "~",
  start: "S",
  exit: "B",
  stairs_up: "^",
  stairs_down: "v",
  escape_gate: "*",
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

    // === LAYOUT CONSTANTS ===
    const HEADER_H = 50;
    const MAP_X = 40;
    const MAP_Y = HEADER_H + 20;
    const MAP_W = 780;
    const MAP_H = 440;
    const ACTION_X = MAP_X + MAP_W + 20;
    const ACTION_W = 380;
    const ROOM_PANEL_Y = MAP_Y + MAP_H + 10;
    const ROOM_PANEL_H = 160;
    const CELL_W = 100;
    const CELL_H = 70;

    // Overlay state
    let activeOverlay: string | null = null;

    // === HEADER BAR ===
    k.add([k.rect(k.width(), HEADER_H), k.pos(0, 0), k.color(20, 20, 35)]);

    // Dungeon name + floor
    k.add([
      k.text(`${DUNGEON.name} - Floor ${state.player.currentDepth}`, { size: 18 }),
      k.pos(20, 15),
      k.color(200, 200, 220),
    ]);

    // HUD stats in header
    const hpText = k.add([
      k.text(`HP: ${state.player.combatStats.currentHp}/${state.player.combatStats.maxHp}`, { size: 16 }),
      k.pos(450, 8),
      k.color(255, 100, 100),
    ]);

    const manaText = k.add([
      k.text(`Mana: ${state.player.combatStats.currentMana}/${state.player.combatStats.maxMana}`, { size: 16 }),
      k.pos(450, 28),
      k.color(100, 150, 255),
    ]);

    k.add([
      k.text(`Crystals: ${state.player.manaCrystals}`, { size: 16 }),
      k.pos(640, 8),
      k.color(255, 215, 0),
    ]);

    k.add([
      k.text(`Tick: ${state.player.dungeonTick}`, { size: 16 }),
      k.pos(640, 28),
      k.color(180, 180, 200),
    ]);

    k.add([
      k.text(`Lv.${state.player.level} XP:${state.player.xp}/${state.player.xpToNext}`, { size: 16 }),
      k.pos(780, 8),
      k.color(200, 255, 200),
    ]);

    k.add([
      k.text(`Fame: ${state.player.fame}`, { size: 16 }),
      k.pos(780, 28),
      k.color(255, 200, 100),
    ]);

    // Header menu buttons
    const menuNames = ["Map", "Bag", "Spells", "Stats", "Save"];
    menuNames.forEach((name, i) => {
      const btn = k.add([
        k.rect(70, 30, { radius: 4 }),
        k.pos(960 + i * 75, 10),
        k.color(40, 40, 60),
        k.area(),
        `menu_${name.toLowerCase()}`,
      ]);
      k.add([
        k.text(name, { size: 14 }),
        k.pos(960 + i * 75 + 35, 25),
        k.anchor("center"),
        k.color(180, 180, 200),
      ]);

      btn.onHover(() => { btn.color = k.rgb(60, 60, 90); });
      btn.onHoverEnd(() => { btn.color = k.rgb(40, 40, 60); });

      btn.onClick(() => {
        if (name === "Save") {
          saveGame();
          showMessage("Game saved!");
        } else if (name === "Bag") {
          showBagOverlay();
        } else if (name === "Spells") {
          showSpellbookOverlay();
        } else if (name === "Stats") {
          showStatsOverlay();
        } else if (name === "Map") {
          // Map is already visible as the floor map
          showMessage("Floor map is displayed below.");
        }
      });
    });

    // === FLOOR MAP ===
    k.add([k.rect(MAP_W, MAP_H, { radius: 8 }), k.pos(MAP_X, MAP_Y), k.color(15, 15, 28)]);

    // Calculate map positions
    const layout = level.mapLayout || {};
    let selectedExit: string | null = null;

    // Find map bounds
    const positions = Object.values(layout);
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));
    const gridW = maxX - minX + 1;
    const gridH = maxY - minY + 1;
    const offsetX = MAP_X + (MAP_W - gridW * CELL_W) / 2;
    const offsetY = MAP_Y + (MAP_H - gridH * CELL_H) / 2;

    // Draw connections first (edges)
    level.rooms.forEach((r) => {
      const pos = layout[r.roomId];
      if (!pos) return;
      const sx = offsetX + (pos.x - minX) * CELL_W + CELL_W / 2;
      const sy = offsetY + (pos.y - minY) * CELL_H + CELL_H / 2;

      r.exits.forEach((exit) => {
        const tPos = layout[exit.targetRoomId];
        if (!tPos) return;
        const tx = offsetX + (tPos.x - minX) * CELL_W + CELL_W / 2;
        const ty = offsetY + (tPos.y - minY) * CELL_H + CELL_H / 2;

        // Draw line
        const dx = tx - sx;
        const dy = ty - sy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        k.add([
          k.rect(len, 2),
          k.pos(sx, sy),
          k.rotate(angle * (180 / Math.PI)),
          k.color(50, 50, 70),
          k.anchor("left"),
        ]);
      });
    });

    // Draw room nodes
    const roomNodes: ReturnType<typeof k.add>[] = [];
    level.rooms.forEach((r) => {
      const pos = layout[r.roomId];
      if (!pos) return;

      const cx = offsetX + (pos.x - minX) * CELL_W + CELL_W / 2;
      const cy = offsetY + (pos.y - minY) * CELL_H + CELL_H / 2;

      const isCurrent = r.roomId === state.player.currentRoomId;
      const discovered = isRoomDiscovered(state.player.currentDepth, r.roomId);
      const isAdjacent = room.exits.some((e) => e.targetRoomId === r.roomId);
      const isBoss = r.feature === "exit";
      const isCombat = r.feature === "combat";

      // Determine fill color
      let fillColor: [number, number, number];
      if (isCurrent) {
        fillColor = [80, 180, 80]; // Green for current
      } else if (!discovered && !isBoss) {
        fillColor = [25, 25, 40]; // Dark for undiscovered
      } else {
        fillColor = FEATURE_COLORS[r.feature] || [60, 60, 80];
      }

      // Border
      let borderColor: [number, number, number] = [50, 50, 70];
      if (isCurrent) borderColor = [120, 255, 120];
      else if (isAdjacent && isCombat && !discovered) borderColor = [200, 60, 60];
      else if (isAdjacent) borderColor = [100, 140, 60];
      else if (isBoss) borderColor = [200, 50, 50];

      // Room background
      const node = k.add([
        k.rect(CELL_W - 10, CELL_H - 10, { radius: 6 }),
        k.pos(cx, cy),
        k.anchor("center"),
        k.color(...fillColor),
        k.area(),
        `room_${r.roomId}`,
      ]);

      // Border rect
      k.add([
        k.rect(CELL_W - 6, CELL_H - 6, { radius: 8 }),
        k.pos(cx, cy),
        k.anchor("center"),
        k.color(...borderColor),
        k.opacity(0.4),
        k.z(-1),
      ]);

      // Feature icon
      const showIcon = discovered || isCurrent || isBoss;
      if (showIcon) {
        k.add([
          k.text(FEATURE_ICONS[r.feature] || "?", { size: 24 }),
          k.pos(cx, cy - 6),
          k.anchor("center"),
          k.color(255, 255, 255),
        ]);
      }

      // Room name (small) for discovered rooms
      if (discovered || isCurrent) {
        k.add([
          k.text(r.name.substring(0, 12), { size: 9 }),
          k.pos(cx, cy + 18),
          k.anchor("center"),
          k.color(160, 160, 180),
        ]);
      }

      // Current room marker
      if (isCurrent) {
        k.add([
          k.text("@", { size: 16 }),
          k.pos(cx + 28, cy - 20),
          k.anchor("center"),
          k.color(255, 255, 0),
        ]);
      }

      // Click handler for adjacent rooms
      if (isAdjacent) {
        node.onClick(() => {
          selectedExit = r.roomId;
          handleMove(r.roomId);
        });

        node.onHover(() => {
          node.color = k.rgb(
            Math.min(255, fillColor[0] + 30),
            Math.min(255, fillColor[1] + 30),
            Math.min(255, fillColor[2] + 30)
          );
        });

        node.onHoverEnd(() => {
          node.color = k.rgb(...fillColor);
        });
      }

      roomNodes.push(node);
    });

    // === RIGHT ACTION PANEL ===
    k.add([k.rect(ACTION_W, MAP_H + ROOM_PANEL_H + 10, { radius: 8 }), k.pos(ACTION_X, MAP_Y), k.color(20, 20, 32)]);

    k.add([
      k.text("Actions", { size: 20 }),
      k.pos(ACTION_X + ACTION_W / 2, MAP_Y + 15),
      k.anchor("center"),
      k.color(200, 200, 220),
    ]);

    // Move section
    k.add([
      k.text("Move To:", { size: 16 }),
      k.pos(ACTION_X + 15, MAP_Y + 50),
      k.color(150, 150, 170),
    ]);

    // Exit buttons
    let exitBtnY = MAP_Y + 75;
    room.exits.forEach((exit) => {
      const targetRoom = level.rooms.find((r) => r.roomId === exit.targetRoomId);
      const discovered = isRoomDiscovered(state.player.currentDepth, exit.targetRoomId);
      const label = discovered
        ? `${exit.direction.toUpperCase()}: ${targetRoom?.name || "Unknown"}`
        : `${exit.direction.toUpperCase()}: ???`;

      const btn = k.add([
        k.rect(ACTION_W - 30, 32, { radius: 4 }),
        k.pos(ACTION_X + 15, exitBtnY),
        k.color(35, 50, 45),
        k.area(),
      ]);

      k.add([
        k.text(label, { size: 13 }),
        k.pos(ACTION_X + 25, exitBtnY + 8),
        k.color(180, 220, 180),
      ]);

      btn.onClick(() => handleMove(exit.targetRoomId));
      btn.onHover(() => { btn.color = k.rgb(50, 75, 60); });
      btn.onHoverEnd(() => { btn.color = k.rgb(35, 50, 45); });

      exitBtnY += 38;
    });

    // Room actions separator
    exitBtnY += 10;
    k.add([k.rect(ACTION_W - 30, 1), k.pos(ACTION_X + 15, exitBtnY), k.color(60, 60, 80)]);
    exitBtnY += 10;

    k.add([
      k.text("Room Actions:", { size: 16 }),
      k.pos(ACTION_X + 15, exitBtnY),
      k.color(150, 150, 170),
    ]);
    exitBtnY += 25;

    // Context-dependent room actions
    const roomActions = getRoomActions(room);
    roomActions.forEach((action) => {
      const btn = k.add([
        k.rect(ACTION_W - 30, 32, { radius: 4 }),
        k.pos(ACTION_X + 15, exitBtnY),
        k.color(...action.color),
        k.area(),
      ]);

      k.add([
        k.text(action.label, { size: 14 }),
        k.pos(ACTION_X + 25, exitBtnY + 8),
        k.color(220, 220, 240),
      ]);

      btn.onClick(action.onClick);
      btn.onHover(() => {
        btn.color = k.rgb(
          Math.min(255, action.color[0] + 20),
          Math.min(255, action.color[1] + 20),
          Math.min(255, action.color[2] + 20)
        );
      });
      btn.onHoverEnd(() => { btn.color = k.rgb(...action.color); });

      exitBtnY += 38;
    });

    // === ROOM INFO PANEL (bottom) ===
    k.add([k.rect(MAP_W, ROOM_PANEL_H, { radius: 8 }), k.pos(MAP_X, ROOM_PANEL_Y), k.color(18, 18, 30)]);

    // Room emblem/icon
    const featureCol = FEATURE_COLORS[room.feature] || [80, 80, 100];
    k.add([
      k.rect(60, 60, { radius: 8 }),
      k.pos(MAP_X + 20, ROOM_PANEL_Y + 15),
      k.color(...featureCol),
    ]);
    k.add([
      k.text(FEATURE_ICONS[room.feature] || "?", { size: 36 }),
      k.pos(MAP_X + 50, ROOM_PANEL_Y + 45),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);

    // Room name and description
    k.add([
      k.text(room.name, { size: 20 }),
      k.pos(MAP_X + 100, ROOM_PANEL_Y + 15),
      k.color(220, 220, 240),
    ]);

    k.add([
      k.text(room.description, { size: 14, width: MAP_W - 140 }),
      k.pos(MAP_X + 100, ROOM_PANEL_Y + 45),
      k.color(160, 160, 180),
    ]);

    // Entity presence
    if (room.entities && room.entities.length > 0) {
      const entityNames = room.entities
        .map((eid) => getEntityById(eid)?.name || "Unknown")
        .join(", ");
      k.add([
        k.text(`Present: ${entityNames}`, { size: 14 }),
        k.pos(MAP_X + 100, ROOM_PANEL_Y + ROOM_PANEL_H - 30),
        k.color(255, 180, 100),
      ]);
    }

    // === Message display ===
    let messageObj: ReturnType<typeof k.add> | null = null;

    function showMessage(msg: string) {
      if (messageObj) messageObj.destroy();
      messageObj = k.add([
        k.text(msg, { size: 16 }),
        k.pos(k.width() / 2, k.height() - 20),
        k.anchor("center"),
        k.color(255, 255, 200),
        k.opacity(1),
        k.lifespan(3),
      ]);
    }

    // === Handlers ===

    function handleMove(targetRoomId: string) {
      const result = moveToRoom(targetRoomId);
      if (!result) return;

      const { room: newRoom, entities } = result;

      // Check for combat rooms with enemies
      const hasHostile = entities.some((e) => e.occupationId === "hostile" || e.occupationId === "boss");
      if (hasHostile && (newRoom.feature === "combat" || newRoom.feature === "exit")) {
        const enemy = entities.find((e) => e.occupationId === "hostile" || e.occupationId === "boss");
        if (enemy) {
          // Deep clone enemy for combat so we don't modify the original
          const combatEnemy = JSON.parse(JSON.stringify(enemy));
          const gs = getGameState();
          gs.currentEnemy = combatEnemy;
          gs.isInCombat = true;
          k.go("combat");
          return;
        }
      }

      // Refresh scene for new room
      k.go("game");
    }

    function handleRest() {
      restAtRoom();
      showMessage("You rest by the spring. HP and Mana fully restored. (1 tick)");
      k.wait(1.5, () => k.go("game"));
    }

    function handleSearch() {
      const loot = searchRoom();
      if (loot) {
        const desc = loot.map((l) => l.name).join(", ");
        showMessage(`Found: ${desc}`);
        k.wait(2, () => k.go("game"));
      } else {
        showMessage("Nothing to search here.");
      }
    }

    function handleTalk(entityId: string) {
      const entity = getEntityById(entityId);
      if (!entity || !entity.dialogueLines) return;
      showDialogueOverlay(entity);
    }

    function handleRuneForge() {
      k.go("runeForge");
    }

    function handleBossOffer() {
      const gs = getGameState();
      if (gs.player.hasGoldenCrystal) {
        gs.player.hasGoldenCrystal = false;
        // Move to next floor
        if (moveToNextFloor()) {
          showMessage("The boss accepts the golden crystal. The way opens.");
          k.wait(2, () => k.go("game"));
        } else {
          showMessage("You've escaped the dungeon! Congratulations!");
          k.wait(3, () => k.go("mainMenu"));
        }
      } else {
        showMessage("You don't have a golden crystal to offer.");
      }
    }

    // === Room action helpers ===

    function getRoomActions(r: Room): { label: string; color: [number, number, number]; onClick: () => void }[] {
      const actions: { label: string; color: [number, number, number]; onClick: () => void }[] = [];

      if (r.feature === "rest") {
        actions.push({ label: "Rest (restore HP/Mana)", color: [30, 80, 60], onClick: handleRest });
      }
      if (r.treasureChestRef) {
        actions.push({ label: "Search (treasure)", color: [80, 70, 20], onClick: handleSearch });
      }
      if (r.feature === "rune_forge") {
        actions.push({ label: "Use Rune Forge", color: [80, 40, 120], onClick: handleRuneForge });
      }
      if (r.feature === "dialogue" && r.entities) {
        r.entities.forEach((eid) => {
          const e = getEntityById(eid);
          if (e && e.dialogueLines) {
            actions.push({ label: `Talk to ${e.name}`, color: [40, 70, 90], onClick: () => handleTalk(eid) });
          }
        });
      }
      if (r.feature === "exit" && r.entities) {
        const boss = r.entities.find((eid) => getEntityById(eid)?.occupationId === "boss");
        if (boss) {
          actions.push({ label: "Offer Golden Crystal", color: [120, 100, 20], onClick: handleBossOffer });
          actions.push({
            label: `Fight ${getEntityById(boss)?.name || "Boss"}`,
            color: [120, 30, 30],
            onClick: () => {
              const enemy = getEntityById(boss);
              if (enemy) {
                const gs = getGameState();
                gs.currentEnemy = JSON.parse(JSON.stringify(enemy));
                gs.isInCombat = true;
                k.go("combat");
              }
            },
          });
        }
      }

      return actions;
    }

    // === Dialogue Overlay ===

    function showDialogueOverlay(entity: EntityDefinition) {
      const overlayObjs: ReturnType<typeof k.add>[] = [];

      // Backdrop
      overlayObjs.push(
        k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.7), k.z(100)])
      );

      // Panel
      const panelW = 700;
      const panelH = 450;
      const px = (k.width() - panelW) / 2;
      const py = (k.height() - panelH) / 2;

      overlayObjs.push(
        k.add([k.rect(panelW, panelH, { radius: 12 }), k.pos(px, py), k.color(25, 25, 40), k.z(101)])
      );

      // NPC name
      overlayObjs.push(
        k.add([
          k.text(entity.name, { size: 24 }),
          k.pos(px + panelW / 2, py + 20),
          k.anchor("center"),
          k.color(255, 215, 0),
          k.z(102),
        ])
      );

      // Dialogue lines
      const lines = entity.dialogueLines || [];
      let currentLine = 0;

      const lineText = k.add([
        k.text(lines[0] || "...", { size: 18, width: panelW - 60 }),
        k.pos(px + 30, py + 70),
        k.color(200, 200, 220),
        k.z(102),
      ]);
      overlayObjs.push(lineText);

      // Next/Close button
      const nextBtn = k.add([
        k.rect(120, 36, { radius: 6 }),
        k.pos(px + panelW / 2, py + panelH - 40),
        k.anchor("center"),
        k.color(40, 60, 80),
        k.area(),
        k.z(102),
      ]);
      overlayObjs.push(nextBtn);

      const nextLabel = k.add([
        k.text("Next", { size: 16 }),
        k.pos(px + panelW / 2, py + panelH - 40),
        k.anchor("center"),
        k.color(200, 220, 255),
        k.z(103),
      ]);
      overlayObjs.push(nextLabel);

      nextBtn.onClick(() => {
        currentLine++;
        if (currentLine >= lines.length) {
          overlayObjs.forEach((o) => o.destroy());
        } else {
          lineText.text = lines[currentLine];
          if (currentLine === lines.length - 1) {
            nextLabel.text = "Close";
          }
        }
      });

      // ESC to close
      k.onKeyPress("escape", () => {
        overlayObjs.forEach((o) => o.destroy());
      });
    }

    // === Bag Overlay ===

    function showBagOverlay() {
      const overlayObjs: ReturnType<typeof k.add>[] = [];

      overlayObjs.push(
        k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.7), k.z(100)])
      );

      const panelW = 500;
      const panelH = 400;
      const px = (k.width() - panelW) / 2;
      const py = (k.height() - panelH) / 2;

      overlayObjs.push(
        k.add([k.rect(panelW, panelH, { radius: 12 }), k.pos(px, py), k.color(25, 25, 40), k.z(101)])
      );

      overlayObjs.push(
        k.add([
          k.text("Bag", { size: 24 }),
          k.pos(px + panelW / 2, py + 20),
          k.anchor("center"),
          k.color(255, 215, 0),
          k.z(102),
        ])
      );

      overlayObjs.push(
        k.add([
          k.text(`Mana Crystals: ${state.player.manaCrystals}`, { size: 16 }),
          k.pos(px + 30, py + 60),
          k.color(255, 215, 0),
          k.z(102),
        ])
      );

      let itemY = py + 90;
      state.player.inventory.forEach((item) => {
        overlayObjs.push(
          k.add([
            k.text(`${item.name} x${item.quantity} - ${item.description}`, { size: 14, width: panelW - 120 }),
            k.pos(px + 30, itemY),
            k.color(180, 180, 200),
            k.z(102),
          ])
        );

        // Use button for consumables
        if (item.kind === "consumable" && item.quantity > 0) {
          const useBtn = k.add([
            k.rect(50, 24, { radius: 4 }),
            k.pos(px + panelW - 80, itemY),
            k.color(40, 80, 60),
            k.area(),
            k.z(102),
          ]);
          overlayObjs.push(useBtn);

          overlayObjs.push(
            k.add([
              k.text("Use", { size: 12 }),
              k.pos(px + panelW - 55, itemY + 5),
              k.color(200, 255, 200),
              k.z(103),
            ])
          );

          useBtn.onClick(() => {
            const result = useItem(item.itemId);
            if (result) {
              showMessage(result);
              overlayObjs.forEach((o) => o.destroy());
              k.go("game");
            }
          });
        }

        itemY += 35;
      });

      if (state.player.inventory.length === 0) {
        overlayObjs.push(
          k.add([
            k.text("Your bag is empty.", { size: 16 }),
            k.pos(px + panelW / 2, py + 120),
            k.anchor("center"),
            k.color(120, 120, 140),
            k.z(102),
          ])
        );
      }

      // Close button
      const closeBtn = k.add([
        k.rect(80, 30, { radius: 4 }),
        k.pos(px + panelW / 2, py + panelH - 30),
        k.anchor("center"),
        k.color(80, 40, 40),
        k.area(),
        k.z(102),
      ]);
      overlayObjs.push(closeBtn);

      overlayObjs.push(
        k.add([
          k.text("Close", { size: 14 }),
          k.pos(px + panelW / 2, py + panelH - 30),
          k.anchor("center"),
          k.color(255, 200, 200),
          k.z(103),
        ])
      );

      closeBtn.onClick(() => overlayObjs.forEach((o) => o.destroy()));
      k.onKeyPress("escape", () => overlayObjs.forEach((o) => o.destroy()));
    }

    // === Spellbook Overlay ===

    function showSpellbookOverlay() {
      const overlayObjs: ReturnType<typeof k.add>[] = [];

      overlayObjs.push(
        k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.7), k.z(100)])
      );

      const panelW = 700;
      const panelH = 500;
      const px = (k.width() - panelW) / 2;
      const py = (k.height() - panelH) / 2;

      overlayObjs.push(
        k.add([k.rect(panelW, panelH, { radius: 12 }), k.pos(px, py), k.color(25, 25, 40), k.z(101)])
      );

      overlayObjs.push(
        k.add([
          k.text("Spellbook", { size: 24 }),
          k.pos(px + panelW / 2, py + 20),
          k.anchor("center"),
          k.color(160, 80, 200),
          k.z(102),
        ])
      );

      // Prepared slots
      overlayObjs.push(
        k.add([
          k.text("Prepared Slots:", { size: 16 }),
          k.pos(px + 30, py + 60),
          k.color(180, 180, 200),
          k.z(102),
        ])
      );

      state.player.preparedSlots.forEach((spell, i) => {
        const slotLabel = spell ? `[${i + 1}] ${spell.name} (${spell.manaCost} mana)` : `[${i + 1}] Empty`;
        overlayObjs.push(
          k.add([
            k.text(slotLabel, { size: 14 }),
            k.pos(px + 50, py + 85 + i * 22),
            k.color(spell ? [200, 200, 255] : [100, 100, 120]),
            k.z(102),
          ])
        );
      });

      // Spell pool
      overlayObjs.push(
        k.add([
          k.text("Known Spells:", { size: 16 }),
          k.pos(px + 30, py + 200),
          k.color(180, 180, 200),
          k.z(102),
        ])
      );

      state.player.spellPool.forEach((spell, i) => {
        const isPrepared = state.player.preparedSlots.some((s) => s?.spellId === spell.spellId);
        overlayObjs.push(
          k.add([
            k.text(
              `${spell.name} - ${spell.categoryId} - ${spell.manaCost} mana - Power: ${spell.power}${isPrepared ? " [PREPARED]" : ""}`,
              { size: 13, width: panelW - 140 }
            ),
            k.pos(px + 50, py + 225 + i * 25),
            k.color(isPrepared ? [160, 200, 255] : [180, 180, 200]),
            k.z(102),
          ])
        );

        // Equip button if not prepared and has empty slot
        if (!isPrepared) {
          const emptySlotIdx = state.player.preparedSlots.findIndex((s) => s === null);
          if (emptySlotIdx >= 0) {
            const eqBtn = k.add([
              k.rect(60, 20, { radius: 3 }),
              k.pos(px + panelW - 90, py + 225 + i * 25),
              k.color(40, 60, 80),
              k.area(),
              k.z(102),
            ]);
            overlayObjs.push(eqBtn);

            overlayObjs.push(
              k.add([
                k.text("Equip", { size: 11 }),
                k.pos(px + panelW - 60, py + 228 + i * 25),
                k.color(200, 220, 255),
                k.z(103),
              ])
            );

            eqBtn.onClick(() => {
              state.player.preparedSlots[emptySlotIdx] = spell;
              overlayObjs.forEach((o) => o.destroy());
              showSpellbookOverlay();
            });
          }
        }
      });

      // Close
      const closeBtn = k.add([
        k.rect(80, 30, { radius: 4 }),
        k.pos(px + panelW / 2, py + panelH - 30),
        k.anchor("center"),
        k.color(80, 40, 80),
        k.area(),
        k.z(102),
      ]);
      overlayObjs.push(closeBtn);

      overlayObjs.push(
        k.add([
          k.text("Close", { size: 14 }),
          k.pos(px + panelW / 2, py + panelH - 30),
          k.anchor("center"),
          k.color(255, 200, 255),
          k.z(103),
        ])
      );

      closeBtn.onClick(() => overlayObjs.forEach((o) => o.destroy()));
      k.onKeyPress("escape", () => overlayObjs.forEach((o) => o.destroy()));
    }

    // === Stats Overlay ===

    function showStatsOverlay() {
      const overlayObjs: ReturnType<typeof k.add>[] = [];

      overlayObjs.push(
        k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(0, 0, 0), k.opacity(0.7), k.z(100)])
      );

      const panelW = 500;
      const panelH = 500;
      const px = (k.width() - panelW) / 2;
      const py = (k.height() - panelH) / 2;

      overlayObjs.push(
        k.add([k.rect(panelW, panelH, { radius: 12 }), k.pos(px, py), k.color(25, 25, 40), k.z(101)])
      );

      overlayObjs.push(
        k.add([
          k.text("Stats", { size: 24 }),
          k.pos(px + panelW / 2, py + 20),
          k.anchor("center"),
          k.color(255, 215, 0),
          k.z(102),
        ])
      );

      const p = state.player;
      const stats = [
        `Name: ${p.name}`,
        `Level: ${p.level}  XP: ${p.xp}/${p.xpToNext}`,
        `Fame: ${p.fame}`,
        "",
        `HP: ${p.combatStats.currentHp}/${p.combatStats.maxHp}`,
        `Mana: ${p.combatStats.currentMana}/${p.combatStats.maxMana}`,
        `Might: ${p.combatStats.might}  Agility: ${p.combatStats.agility}`,
        `Insight: ${p.combatStats.insight}  Willpower: ${p.combatStats.willpower}`,
        `Defense: ${p.combatStats.defense}  Power: ${p.combatStats.power}`,
        "",
        `Mana Crystals: ${p.manaCrystals}`,
        `Dungeon Tick: ${p.dungeonTick}`,
        `Floor: ${p.currentDepth}`,
        `Title: ${p.equippedTitleId || "None"}`,
      ];

      stats.forEach((line, i) => {
        overlayObjs.push(
          k.add([
            k.text(line, { size: 15 }),
            k.pos(px + 30, py + 60 + i * 24),
            k.color(180, 180, 200),
            k.z(102),
          ])
        );
      });

      // Close
      const closeBtn = k.add([
        k.rect(80, 30, { radius: 4 }),
        k.pos(px + panelW / 2, py + panelH - 30),
        k.anchor("center"),
        k.color(80, 40, 40),
        k.area(),
        k.z(102),
      ]);
      overlayObjs.push(closeBtn);

      overlayObjs.push(
        k.add([
          k.text("Close", { size: 14 }),
          k.pos(px + panelW / 2, py + panelH - 30),
          k.anchor("center"),
          k.color(255, 200, 200),
          k.z(103),
        ])
      );

      closeBtn.onClick(() => overlayObjs.forEach((o) => o.destroy()));
      k.onKeyPress("escape", () => overlayObjs.forEach((o) => o.destroy()));
    }

    // === Keyboard shortcuts ===

    k.onKeyPress("b", () => showBagOverlay());
    k.onKeyPress("s", () => showSpellbookOverlay());
    k.onKeyPress("tab", () => showStatsOverlay());
  });
}
