// Bag overlay scene

import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { getContent } from "../content";
import { COLORS, addButton, addPanel, addTitle, addLabel } from "../ui";

const TAG = "bag-ui";

export function registerBagScene(k: KAPLAYCtx): void {
  k.scene("bag", (sceneData: { gameState: GameState }) => {
    renderBag(k, sceneData.gameState);
  });
}

function renderBag(k: KAPLAYCtx, gs: GameState): void {
  k.destroyAll(TAG);

  const content = getContent();
  const cx = k.width() / 2;
  const cy = k.height() / 2;

  addPanel(k, cx, cy, 500, 450, TAG, {
    color: [20, 24, 20],
    borderColor: [80, 140, 80],
  });

  addTitle(k, "Inventory", cx, cy - 180, TAG, { size: 28, color: COLORS.gold });

  // Crystals
  addLabel(k, `Mana Crystals: ${gs.player.crystals}`, cx, cy - 140, TAG, {
    size: 18, color: COLORS.gold, anchor: "center",
  });

  // Items
  addLabel(k, "Items:", 200, cy - 105, TAG, { size: 16, color: COLORS.textDim });

  const itemEntries = Object.entries(gs.player.items).filter(([_, count]) => count > 0);
  if (itemEntries.length === 0) {
    addLabel(k, "No items.", 200, cy - 75, TAG, { size: 14, color: COLORS.textDim });
  }

  itemEntries.forEach(([itemId, count], i) => {
    const item = content.items.find((it) => it.id === itemId);
    const name = item?.name || itemId;
    const desc = item?.description || "";

    addLabel(k, `${name} x${count}`, 200, cy - 75 + i * 30, TAG, {
      size: 16, color: COLORS.text,
    });
    addLabel(k, desc, 200, cy - 58 + i * 30, TAG, {
      size: 11, color: COLORS.textDim,
    });
  });

  // Runes section
  const runeY = cy + 30;
  addLabel(k, "Runes:", 200, runeY, TAG, { size: 16, color: COLORS.textDim });

  const runeCounts: Record<string, number> = {};
  for (const runeId of gs.player.runes) {
    runeCounts[runeId] = (runeCounts[runeId] || 0) + 1;
  }

  const runeEntries = Object.entries(runeCounts);
  if (runeEntries.length === 0) {
    addLabel(k, "No runes.", 200, runeY + 25, TAG, { size: 14, color: COLORS.textDim });
  }

  runeEntries.forEach(([runeId, count], i) => {
    const rune = content.runes.find((r) => r.id === runeId);
    const name = rune?.name || runeId;
    const r2 = rune ? parseInt(rune.color.slice(1, 3), 16) : 180;
    const g2 = rune ? parseInt(rune.color.slice(3, 5), 16) : 180;
    const b2 = rune ? parseInt(rune.color.slice(5, 7), 16) : 180;

    addLabel(k, `${name} x${count}`, 200, runeY + 25 + i * 22, TAG, {
      size: 15, color: [r2, g2, b2],
    });
  });

  // Stats
  addLabel(k, `Level: ${gs.player.level}  |  XP: ${gs.player.xp}/${gs.player.level * 50}`, cx, cy + 150, TAG, {
    size: 14, color: COLORS.textDim, anchor: "center",
  });

  // Back
  addButton(k, "Close", cx, cy + 190, {
    tag: TAG, width: 160, height: 40, color: COLORS.textDim, fontSize: 16,
    onClick: () => k.go("room", { gameState: gs }),
  });
}
