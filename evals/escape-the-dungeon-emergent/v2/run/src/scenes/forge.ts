// Forge scene — rune combining and spell crafting
// Gate G2: Must be fully functional — select runes, combine, create spell, use it

import type { KAPLAYCtx } from "kaplay";
import type { GameState, Rune, SpellRecipe } from "../types";
import { getContent } from "../content";
import { saveGame } from "../state";
import {
  COLORS,
  addButton,
  addPanel,
  addTitle,
  addLabel,
} from "../ui";

const TAG = "forge-ui";

interface ForgeState {
  selectedRunes: string[]; // rune ids selected for crafting (max 2)
  message: string | null;
  messageColor: readonly [number, number, number];
}

export function registerForgeScene(k: KAPLAYCtx): void {
  k.scene("forge", (sceneData: { gameState: GameState }) => {
    const forgeState: ForgeState = {
      selectedRunes: [],
      message: null,
      messageColor: COLORS.text,
    };
    renderForge(k, sceneData.gameState, forgeState);
  });
}

function renderForge(k: KAPLAYCtx, gs: GameState, forge: ForgeState): void {
  k.destroyAll(TAG);

  const content = getContent();
  const W = k.width();
  const H = k.height();
  const cx = W / 2;

  // Background
  addPanel(k, cx, H / 2, W - 30, H - 30, TAG, {
    color: [22, 16, 12],
    borderColor: COLORS.forge,
  });

  // Title
  addTitle(k, "Rune Forge", cx, 50, TAG, { size: 30, color: COLORS.forge });

  addLabel(k, "Select two runes to combine into a spell", cx, 85, TAG, {
    size: 14, color: COLORS.textDim, anchor: "center",
  });

  // ====== Your Runes ======
  addLabel(k, "Your Runes:", 40, 115, TAG, { size: 16, color: COLORS.gold });

  // Count runes
  const runeCounts: Record<string, number> = {};
  for (const runeId of gs.player.runes) {
    runeCounts[runeId] = (runeCounts[runeId] || 0) + 1;
  }

  const runeEntries = Object.entries(runeCounts);
  runeEntries.forEach(([runeId, count], i) => {
    const rune = content.runes.find((r: Rune) => r.id === runeId);
    if (!rune) return;

    const x = 40 + (i % 5) * 150;
    const y = 145 + Math.floor(i / 5) * 60;

    // Parse hex color
    const r2 = parseInt(rune.color.slice(1, 3), 16);
    const g2 = parseInt(rune.color.slice(3, 5), 16);
    const b2 = parseInt(rune.color.slice(5, 7), 16);

    const isSelected = forge.selectedRunes.filter((s) => s === runeId).length > 0;

    addButton(k, `${rune.name} x${count}`, x + 60, y, {
      tag: TAG,
      width: 130,
      height: 42,
      color: isSelected ? [r2, g2, b2] : [Math.floor(r2 * 0.4), Math.floor(g2 * 0.4), Math.floor(b2 * 0.4)],
      hoverColor: [r2, g2, b2],
      fontSize: 14,
      onClick: () => {
        if (forge.selectedRunes.length < 2) {
          // Check we have enough of this rune
          const selectedCount = forge.selectedRunes.filter((s) => s === runeId).length;
          if (selectedCount < count) {
            forge.selectedRunes.push(runeId);
            renderForge(k, gs, forge);
          }
        }
      },
    });
  });

  // ====== Selected Runes Display ======
  const selY = 280;
  addPanel(k, cx, selY, W - 80, 80, TAG, {
    color: [28, 20, 16],
    borderColor: COLORS.forge,
  });

  addLabel(k, "Combine:", 60, selY - 15, TAG, { size: 16, color: COLORS.forge });

  forge.selectedRunes.forEach((runeId, i) => {
    const rune = content.runes.find((r: Rune) => r.id === runeId);
    if (!rune) return;

    const r2 = parseInt(rune.color.slice(1, 3), 16);
    const g2 = parseInt(rune.color.slice(3, 5), 16);
    const b2 = parseInt(rune.color.slice(5, 7), 16);

    // Rune display
    k.add([
      k.rect(80, 40, { radius: 6 }),
      k.pos(180 + i * 140, selY),
      k.anchor("center"),
      k.color(k.rgb(r2, g2, b2)),
      k.opacity(0.6),
      TAG,
    ]);

    addLabel(k, rune.name, 180 + i * 140, selY, TAG, {
      size: 16, color: [255, 255, 255], anchor: "center",
    });

    if (i === 0 && forge.selectedRunes.length === 2) {
      addLabel(k, "+", 250, selY, TAG, { size: 24, color: COLORS.gold, anchor: "center" });
    }
  });

  // Clear selection button
  if (forge.selectedRunes.length > 0) {
    addButton(k, "Clear", cx + 200, selY, {
      tag: TAG, width: 80, height: 32, color: COLORS.danger, fontSize: 14,
      onClick: () => {
        forge.selectedRunes = [];
        forge.message = null;
        renderForge(k, gs, forge);
      },
    });
  }

  // ====== Craft Button ======
  if (forge.selectedRunes.length === 2) {
    // Check if recipe exists
    const recipe = findRecipe(content.recipes, forge.selectedRunes);

    addButton(k, "Forge Spell!", cx, 350, {
      tag: TAG, width: 200, height: 50, color: COLORS.gold, fontSize: 20,
      textColor: [40, 20, 0],
      onClick: () => {
        if (recipe) {
          // Check if already crafted
          if (gs.player.craftedSpells.includes(recipe.id)) {
            forge.message = `You already know ${recipe.name}!`;
            forge.messageColor = COLORS.textDim;
          } else {
            // Remove runes from inventory
            for (const runeId of forge.selectedRunes) {
              const idx = gs.player.runes.indexOf(runeId);
              if (idx >= 0) gs.player.runes.splice(idx, 1);
            }
            // Add spell
            gs.player.craftedSpells.push(recipe.id);
            gs.player.equippedSpells.push(recipe.id);
            forge.message = `Crafted: ${recipe.name}!`;
            forge.messageColor = COLORS.success;
            saveGame(gs);
          }
        } else {
          forge.message = "No known recipe for this combination.";
          forge.messageColor = COLORS.danger;
        }
        forge.selectedRunes = [];
        renderForge(k, gs, forge);
      },
    });
  }

  // ====== Message ======
  if (forge.message) {
    addLabel(k, forge.message, cx, 395, TAG, {
      size: 18, color: forge.messageColor, anchor: "center",
    });
  }

  // ====== Known Recipes ======
  addLabel(k, "Known Recipes:", 40, 430, TAG, { size: 16, color: COLORS.gold });

  const knownRecipes = content.recipes.slice(0, 9);
  knownRecipes.forEach((recipe: SpellRecipe, i: number) => {
    const x = 40 + (i % 3) * 260;
    const y = 460 + Math.floor(i / 3) * 40;
    const isKnown = gs.player.craftedSpells.includes(recipe.id);
    const runeNames = recipe.runes
      .map((rid: string) => content.runes.find((r: Rune) => r.id === rid)?.name || rid)
      .join(" + ");

    const displayText = isKnown
      ? `${recipe.name} (${runeNames})`
      : `??? (${runeNames})`;

    addLabel(k, displayText, x, y, TAG, {
      size: 12,
      color: isKnown ? COLORS.success : COLORS.textDim,
    });
  });

  // ====== Crafted Spells ======
  addLabel(k, "Your Spells:", 40, 570, TAG, { size: 16, color: COLORS.gold });

  gs.player.craftedSpells.forEach((spellId, i) => {
    const spell = content.recipes.find((r) => r.id === spellId);
    if (!spell) return;
    addLabel(k, `${spell.name} - ${spell.description}`, 40, 595 + i * 20, TAG, {
      size: 13, color: COLORS.text,
    });
  });

  // ====== Leave button ======
  addButton(k, "Leave Forge", cx, H - 45, {
    tag: TAG, width: 200, height: 44, color: COLORS.textDim, fontSize: 18,
    onClick: () => {
      k.go("room", { gameState: gs });
    },
  });
}

function findRecipe(recipes: SpellRecipe[], selectedRunes: string[]): SpellRecipe | undefined {
  const sorted = [...selectedRunes].sort();
  return recipes.find((r) => {
    const recipeSorted = [...r.runes].sort();
    return recipeSorted.length === sorted.length &&
      recipeSorted.every((v, i) => v === sorted[i]);
  });
}
