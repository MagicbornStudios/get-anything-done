// Spellbook overlay scene

import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { getContent } from "../content";
import { COLORS, addButton, addPanel, addTitle, addLabel } from "../ui";

const TAG = "spell-ui";

export function registerSpellbookScene(k: KAPLAYCtx): void {
  k.scene("spellbook", (sceneData: { gameState: GameState }) => {
    renderSpellbook(k, sceneData.gameState);
  });
}

function renderSpellbook(k: KAPLAYCtx, gs: GameState): void {
  k.destroyAll(TAG);

  const content = getContent();
  const cx = k.width() / 2;
  const cy = k.height() / 2;

  addPanel(k, cx, cy, 520, 460, TAG, {
    color: [20, 16, 30],
    borderColor: [120, 80, 200],
  });

  addTitle(k, "Spellbook", cx, cy - 190, TAG, { size: 28, color: [180, 130, 255] });

  addLabel(k, "Crafted Spells (equipped for combat):", 170, cy - 155, TAG, {
    size: 14, color: COLORS.textDim,
  });

  if (gs.player.craftedSpells.length === 0) {
    addLabel(k, "No spells crafted yet. Visit a Forge!", cx, cy - 100, TAG, {
      size: 16, color: COLORS.textDim, anchor: "center",
    });
  }

  gs.player.craftedSpells.forEach((spellId, i) => {
    const spell = content.recipes.find((r) => r.id === spellId);
    if (!spell) return;

    const y = cy - 120 + i * 65;

    // Spell card
    const r2 = parseInt(spell.color.slice(1, 3), 16);
    const g2 = parseInt(spell.color.slice(3, 5), 16);
    const b2 = parseInt(spell.color.slice(5, 7), 16);

    addPanel(k, cx, y, 440, 50, TAG, {
      color: [Math.floor(r2 * 0.15), Math.floor(g2 * 0.15), Math.floor(b2 * 0.15)],
      borderColor: [r2, g2, b2],
    });

    addLabel(k, spell.name, cx - 180, y - 10, TAG, {
      size: 18, color: [r2, g2, b2],
    });

    addLabel(k, `${spell.manaCost} MP | ${spell.damage > 0 ? spell.damage + " DMG" : spell.effect?.type || "Special"}`, cx - 180, y + 10, TAG, {
      size: 12, color: COLORS.textDim,
    });

    addLabel(k, spell.description, cx + 40, y - 2, TAG, {
      size: 12, color: COLORS.text, anchor: "center",
    });
  });

  // Back
  addButton(k, "Close", cx, cy + 195, {
    tag: TAG, width: 160, height: 40, color: COLORS.textDim, fontSize: 16,
    onClick: () => k.go("room", { gameState: gs }),
  });
}
