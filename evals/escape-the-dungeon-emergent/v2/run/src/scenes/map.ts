// Map overlay scene — shows discovered rooms

import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { getContent } from "../content";
import {
  COLORS,
  addButton,
  addPanel,
  addRoomIcon,
  addTitle,
  addLabel,
  getRoomTypeName,
  getRoomTypeColor,
} from "../ui";

const TAG = "map-ui";

export function registerMapScene(k: KAPLAYCtx): void {
  k.scene("map", (sceneData: { gameState: GameState }) => {
    renderMap(k, sceneData.gameState);
  });
}

function renderMap(k: KAPLAYCtx, gs: GameState): void {
  k.destroyAll(TAG);

  const content = getContent();
  const floor = content.floors.find((f) => f.id === gs.player.currentFloorId);
  if (!floor) return;

  const cx = k.width() / 2;
  const cy = k.height() / 2;

  addPanel(k, cx, cy, k.width() - 30, k.height() - 30, TAG, {
    color: [16, 18, 24],
    borderColor: COLORS.accent,
  });

  addTitle(k, "Dungeon Map", cx, 40, TAG, { size: 26, color: COLORS.accent });

  addLabel(k, "Discovered rooms are shown. Current room is highlighted.", cx, 70, TAG, {
    size: 13, color: COLORS.textDim, anchor: "center",
  });

  // Layout rooms in a grid
  const cols = 4;
  const cellW = 180;
  const cellH = 90;
  const startX = cx - (cols * cellW) / 2 + cellW / 2;
  const startY = 110;

  floor.rooms.forEach((room, i) => {
    const discovered = gs.player.discoveredRooms.includes(room.id);
    const isCurrent = room.id === gs.player.currentRoomId;

    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;

    if (!discovered && room.type !== "boss") {
      // Undiscovered room - foggy
      addPanel(k, x, y, cellW - 12, cellH - 12, TAG, {
        color: [24, 24, 32],
        borderColor: [40, 40, 50],
      });
      addLabel(k, "???", x, y, TAG, {
        size: 18, color: [50, 50, 60], anchor: "center",
      });
      return;
    }

    const roomColor = getRoomTypeColor(room.type);
    const borderCol = isCurrent ? COLORS.gold : roomColor;

    addPanel(k, x, y, cellW - 12, cellH - 12, TAG, {
      color: isCurrent ? [30, 30, 20] : [24, 24, 36],
      borderColor: borderCol,
    });

    addRoomIcon(k, x - cellW / 2 + 30, y - 10, room.type, 28, TAG);

    const displayName = room.name.length > 16 ? room.name.slice(0, 14) + ".." : room.name;
    addLabel(k, displayName, x + 10, y - 18, TAG, {
      size: 12, color: COLORS.text, anchor: "center",
    });

    addLabel(k, getRoomTypeName(room.type), x + 10, y + 2, TAG, {
      size: 11, color: roomColor, anchor: "center",
    });

    if (isCurrent) {
      addLabel(k, "YOU", x + 10, y + 20, TAG, {
        size: 12, color: COLORS.gold, anchor: "center",
      });
    }

    // Show exit directions
    const exitDirs = Object.keys(room.exits).join(", ");
    addLabel(k, exitDirs, x + 10, y + 32, TAG, {
      size: 10, color: COLORS.textDim, anchor: "center",
    });
  });

  // Back
  addButton(k, "Close", cx, k.height() - 45, {
    tag: TAG, width: 160, height: 40, color: COLORS.textDim, fontSize: 16,
    onClick: () => k.go("room", { gameState: gs }),
  });
}
