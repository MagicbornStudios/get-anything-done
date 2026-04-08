// Room scene — main navigation hub
// Skill: kaplay-scene-pattern (destroyAll + re-render)
// Skill: game-loop-verification (must always return here after combat/dialogue)

import type { KAPLAYCtx } from "kaplay";
import type { GameState, Room } from "../types";
import { getContent } from "../content";
import { saveGame } from "../state";
import {
  COLORS,
  addButton,
  addPanel,
  addBar,
  addRoomIcon,
  addTitle,
  addLabel,
  getRoomTypeName,
  getRoomTypeColor,
} from "../ui";

const TAG = "room-ui";

export function registerRoomScene(k: KAPLAYCtx): void {
  k.scene("room", (sceneData: { gameState: GameState }) => {
    const gs = sceneData.gameState;

    // On scene entry: discover rooms, tick, save
    const content = getContent();
    const floor = content.floors.find((f) => f.id === gs.player.currentFloorId);
    const room = floor?.rooms.find((r) => r.id === gs.player.currentRoomId);
    if (room) {
      for (const targetId of Object.values(room.exits)) {
        if (!gs.player.discoveredRooms.includes(targetId)) {
          gs.player.discoveredRooms.push(targetId);
        }
      }
      gs.player.dungeonTick += 1;
    }

    saveGame(gs);
    renderRoom(k, gs);
  });
}

function renderRoom(k: KAPLAYCtx, gs: GameState): void {
  k.destroyAll(TAG);

  const content = getContent();
  const floor = content.floors.find((f) => f.id === gs.player.currentFloorId);
  if (!floor) return;

  const room = floor.rooms.find((r) => r.id === gs.player.currentRoomId);
  if (!room) return;

  const W = k.width();
  const H = k.height();

  // ====== HUD at top ======
  renderHUD(k, gs, W);

  // ====== Room panel (center) ======
  const roomColor = getRoomTypeColor(room.type);

  addPanel(k, W / 2, 200, W - 60, 160, TAG, {
    color: [24, 24, 38],
    borderColor: roomColor,
  });

  // Room icon
  addRoomIcon(k, 60, 200, room.type, 50, TAG);

  // Room name and type
  addTitle(k, room.name, W / 2 + 20, 155, TAG, {
    size: 24,
    color: roomColor,
  });

  const typeLabel = getRoomTypeName(room.type);
  addLabel(k, typeLabel, W / 2 + 20, 185, TAG, {
    size: 14,
    color: COLORS.textDim,
    anchor: "center",
  });

  // Room description (plain text, no KAPLAY styled tags to avoid crash)
  addLabel(k, room.description, W / 2 + 20, 215, TAG, {
    size: 14,
    color: COLORS.text,
    anchor: "center",
  });

  // ====== Room interaction ======
  renderRoomInteraction(k, gs, room, W, H);

  // ====== Navigation exits ======
  renderExits(k, gs, room, floor, W, H);

  // ====== Menu buttons (right side) ======
  renderMenuButtons(k, gs, W);
}

function renderHUD(k: KAPLAYCtx, gs: GameState, W: number): void {
  // HUD background
  addPanel(k, W / 2, 35, W - 20, 55, TAG, {
    color: [18, 18, 30],
    borderColor: COLORS.panelBorder,
  });

  const p = gs.player;

  // Player name and level
  addLabel(k, `${p.name} Lv.${p.level}`, 30, 20, TAG, {
    size: 16,
    color: COLORS.gold,
  });

  // HP bar
  addBar(k, 160, 18, p.combatStats.currentHp, p.combatStats.maxHp, {
    tag: TAG,
    width: 160,
    height: 18,
    fillColor: COLORS.hpBar,
    bgColor: COLORS.hpBarBg,
    label: "HP",
  });

  // Mana bar
  addBar(k, 340, 18, p.combatStats.currentMana, p.combatStats.maxMana, {
    tag: TAG,
    width: 140,
    height: 18,
    fillColor: COLORS.manaBar,
    bgColor: COLORS.manaBarBg,
    label: "MP",
  });

  // Floor and tick
  addLabel(k, `Floor 1`, 510, 20, TAG, {
    size: 14,
    color: COLORS.textDim,
  });

  addLabel(k, `Tick: ${p.dungeonTick}`, 580, 20, TAG, {
    size: 14,
    color: COLORS.textDim,
  });

  // Crystals
  addLabel(k, `Crystals: ${p.crystals}`, 680, 20, TAG, {
    size: 14,
    color: COLORS.gold,
  });

  // XP bar
  const xpNeeded = p.level * 50;
  addBar(k, 160, 42, p.xp, xpNeeded, {
    tag: TAG,
    width: 140,
    height: 12,
    fillColor: COLORS.xpBar,
    bgColor: [40, 40, 30],
    label: "XP",
  });
}

function renderRoomInteraction(
  k: KAPLAYCtx,
  gs: GameState,
  room: Room,
  W: number,
  _H: number
): void {
  const y = 310;

  switch (room.type) {
    case "combat":
    case "boss": {
      addPanel(k, W / 2, y, 300, 50, TAG, { color: [40, 20, 20], borderColor: COLORS.combat });
      addLabel(k, "An enemy blocks your path!", W / 2, y, TAG, {
        size: 16, color: COLORS.danger, anchor: "center",
      });
      addButton(k, "Fight!", W / 2, y + 45, {
        tag: TAG, width: 180, height: 42,
        color: COLORS.combat,
        fontSize: 20,
        onClick: () => {
          k.go("combat", { gameState: gs, enemyTypeId: room.enemyType || "goblin" });
        },
      });
      break;
    }

    case "dialogue": {
      addButton(k, "Talk", W / 2, y + 20, {
        tag: TAG, width: 180, height: 42,
        color: COLORS.dialogue,
        fontSize: 18,
        onClick: () => {
          k.go("dialogue", { gameState: gs, npcId: room.npcId || "old_sage" });
        },
      });
      break;
    }

    case "treasure": {
      if (!gs.player.collectedTreasure.includes(room.id)) {
        addButton(k, "Open Chest", W / 2, y + 20, {
          tag: TAG, width: 200, height: 42,
          color: COLORS.treasure,
          fontSize: 18,
          onClick: () => {
            const crystals = room.loot?.crystals || 10;
            gs.player.crystals += crystals;
            gs.player.collectedTreasure.push(room.id);
            saveGame(gs);
            renderRoom(k, gs);
          },
        });
      } else {
        addLabel(k, "Chest already opened.", W / 2, y + 20, TAG, {
          size: 16, color: COLORS.textDim, anchor: "center",
        });
      }
      break;
    }

    case "rest": {
      addButton(k, "Rest and Heal", W / 2, y + 20, {
        tag: TAG, width: 200, height: 42,
        color: COLORS.rest,
        fontSize: 18,
        onClick: () => {
          gs.player.combatStats.currentHp = gs.player.combatStats.maxHp;
          gs.player.combatStats.currentMana = gs.player.combatStats.maxMana;
          saveGame(gs);
          renderRoom(k, gs);
        },
      });
      break;
    }

    case "forge": {
      addButton(k, "Enter Rune Forge", W / 2, y + 20, {
        tag: TAG, width: 220, height: 42,
        color: COLORS.forge,
        fontSize: 18,
        onClick: () => {
          k.go("forge", { gameState: gs });
        },
      });
      break;
    }

    default: {
      addLabel(k, "A quiet room. Nothing to interact with.", W / 2, y + 10, TAG, {
        size: 14, color: COLORS.textDim, anchor: "center",
      });
    }
  }
}

function renderExits(
  k: KAPLAYCtx,
  gs: GameState,
  room: Room,
  floor: { rooms: Room[] },
  W: number,
  _H: number
): void {
  const exitEntries = Object.entries(room.exits);
  const startY = 400;
  const colWidth = (W - 80) / Math.min(exitEntries.length, 4);

  addLabel(k, "Exits:", 40, startY - 10, TAG, {
    size: 16,
    color: COLORS.textDim,
  });

  exitEntries.forEach(([direction, targetId], i) => {
    const targetRoom = floor.rooms.find((r) => r.id === targetId);
    if (!targetRoom) return;

    const x = 40 + colWidth * i + colWidth / 2;
    const y = startY + 35;
    const roomColor = getRoomTypeColor(targetRoom.type);

    // Exit button panel
    addPanel(k, x, y, colWidth - 12, 70, TAG, {
      color: [28, 28, 44],
      borderColor: roomColor,
    });

    // Direction label
    addLabel(k, direction.charAt(0).toUpperCase() + direction.slice(1), x, y - 22, TAG, {
      size: 13,
      color: COLORS.textDim,
      anchor: "center",
    });

    // Room icon mini
    addRoomIcon(k, x - colWidth / 2 + 24, y + 4, targetRoom.type, 24, TAG);

    // Room name (truncated)
    const displayName = targetRoom.name.length > 14 ? targetRoom.name.slice(0, 12) + ".." : targetRoom.name;
    addLabel(k, displayName, x + 10, y - 2, TAG, {
      size: 12,
      color: COLORS.text,
      anchor: "center",
    });

    // Click area for navigation
    addButton(k, "Go", x, y + 22, {
      tag: TAG,
      width: colWidth - 30,
      height: 26,
      color: roomColor,
      fontSize: 13,
      onClick: () => {
        gs.player.currentRoomId = targetId;
        saveGame(gs);
        // CRITICAL: Re-enter room scene to trigger fresh render
        k.go("room", { gameState: gs });
      },
    });
  });
}

function renderMenuButtons(k: KAPLAYCtx, gs: GameState, W: number): void {
  const btnX = W - 70;

  addButton(k, "Bag", btnX, 90, {
    tag: TAG, width: 90, height: 32, fontSize: 14,
    color: [70, 70, 100],
    onClick: () => { k.go("bag", { gameState: gs }); },
  });

  addButton(k, "Spells", btnX, 130, {
    tag: TAG, width: 90, height: 32, fontSize: 14,
    color: [80, 60, 120],
    onClick: () => { k.go("spellbook", { gameState: gs }); },
  });

  addButton(k, "Map", btnX, 170, {
    tag: TAG, width: 90, height: 32, fontSize: 14,
    color: [60, 80, 80],
    onClick: () => { k.go("map", { gameState: gs }); },
  });
}
