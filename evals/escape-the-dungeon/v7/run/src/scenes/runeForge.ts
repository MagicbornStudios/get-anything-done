import type { KAPLAYCtx } from "kaplay";
import { getGameState, craftSpell } from "../systems/gameState";
import { RUNES } from "../content/runes";

export function loadRuneForgeScene(k: KAPLAYCtx) {
  k.scene("runeForge", () => {
    const state = getGameState();
    const selectedRunes: string[] = [];

    // Background
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(25, 18, 12)]);

    // Header
    k.add([k.rect(k.width(), 50), k.pos(0, 0), k.color(35, 20, 15)]);
    k.add([
      k.text("RUNE FORGE", { size: 24 }),
      k.pos(k.width() / 2, 25),
      k.anchor("center"),
      k.color(255, 180, 100),
    ]);

    // Crystals display
    const crystalText = k.add([
      k.text(`Crystals: ${state.player.manaCrystals} (Cost: 5)`, { size: 14 }),
      k.pos(k.width() - 220, 20),
      k.color(180, 200, 255),
    ]);

    // === SELECTED RUNES DISPLAY ===
    k.add([
      k.text("Selected Runes:", { size: 16 }),
      k.pos(40, 65),
      k.color(200, 180, 150),
    ]);

    const selectedContainer = k.add([
      k.rect(400, 60, { radius: 8 }),
      k.pos(40, 90),
      k.color(18, 12, 8),
    ]);

    const selectedLabels: ReturnType<typeof k.add>[] = [];

    function updateSelectedDisplay() {
      selectedLabels.forEach((l) => l.destroy());
      selectedLabels.length = 0;

      if (selectedRunes.length === 0) {
        const lbl = k.add([
          k.text("Click runes below to add (1-4 runes)", { size: 13 }),
          k.pos(55, 112),
          k.color(100, 100, 120),
        ]);
        selectedLabels.push(lbl);
      } else {
        selectedRunes.forEach((runeId, i) => {
          const rune = RUNES.find((r) => r.runeId === runeId);
          if (!rune) return;

          // Parse hex color
          const c = hexToRgb(rune.color);

          const box = k.add([
            k.rect(70, 40, { radius: 6 }),
            k.pos(55 + i * 85, 100),
            k.color(c[0], c[1], c[2]),
            k.area(),
          ]);

          const lbl = k.add([
            k.text(`${rune.symbol}`, { size: 22 }),
            k.pos(55 + i * 85 + 35, 120),
            k.anchor("center"),
            k.color(255, 255, 255),
          ]);

          // Click to remove
          box.onClick(() => {
            selectedRunes.splice(i, 1);
            updateSelectedDisplay();
          });

          selectedLabels.push(box, lbl);
        });
      }

      crystalText.text = `Crystals: ${state.player.manaCrystals} (Cost: 5)`;
    }

    updateSelectedDisplay();

    // === RUNE GRID ===
    k.add([
      k.text("Available Runes (A-Z):", { size: 16 }),
      k.pos(40, 165),
      k.color(200, 180, 150),
    ]);

    const runeGridX = 40;
    const runeGridY = 190;
    const runeW = 80;
    const runeH = 50;
    const cols = 9;

    RUNES.forEach((rune, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rx = runeGridX + col * (runeW + 8);
      const ry = runeGridY + row * (runeH + 8);

      const c = hexToRgb(rune.color);
      const affinity = state.player.runeAffinities[rune.runeId] || 0;

      const runeBtn = k.add([
        k.rect(runeW, runeH, { radius: 6 }),
        k.pos(rx, ry),
        k.color(Math.floor(c[0] * 0.5), Math.floor(c[1] * 0.5), Math.floor(c[2] * 0.5)),
        k.area(),
      ]);

      // Symbol
      k.add([
        k.text(rune.symbol, { size: 20 }),
        k.pos(rx + 15, ry + 8),
        k.color(c[0], c[1], c[2]),
      ]);

      // Name
      k.add([
        k.text(rune.name, { size: 9 }),
        k.pos(rx + 40, ry + 10),
        k.color(180, 180, 190),
      ]);

      // Affinity
      k.add([
        k.text(`Aff: ${affinity}`, { size: 9 }),
        k.pos(rx + 40, ry + 25),
        k.color(140, 140, 160),
      ]);

      // Power
      k.add([
        k.text(`Pow: ${rune.basePower}`, { size: 9 }),
        k.pos(rx + 5, ry + 38),
        k.color(120, 120, 140),
      ]);

      runeBtn.onClick(() => {
        if (selectedRunes.length < 4) {
          selectedRunes.push(rune.runeId);
          updateSelectedDisplay();
        }
      });

      runeBtn.onHover(() => {
        runeBtn.color = k.rgb(
          Math.min(255, Math.floor(c[0] * 0.7) + 30),
          Math.min(255, Math.floor(c[1] * 0.7) + 30),
          Math.min(255, Math.floor(c[2] * 0.7) + 30)
        );
      });

      runeBtn.onHoverEnd(() => {
        runeBtn.color = k.rgb(
          Math.floor(c[0] * 0.5),
          Math.floor(c[1] * 0.5),
          Math.floor(c[2] * 0.5)
        );
      });
    });

    // === ACTION BUTTONS ===
    const actionY = 420;

    // Craft button
    const craftBtn = k.add([
      k.rect(200, 45, { radius: 6 }),
      k.pos(40, actionY),
      k.color(80, 50, 30),
      k.area(),
    ]);

    k.add([
      k.text("Craft Spell (5 crystals)", { size: 15 }),
      k.pos(140, actionY + 22),
      k.anchor("center"),
      k.color(255, 200, 140),
    ]);

    const resultText = k.add([
      k.text("", { size: 14, width: 500 }),
      k.pos(40, actionY + 60),
      k.color(200, 255, 200),
    ]);

    craftBtn.onClick(() => {
      if (selectedRunes.length === 0) {
        resultText.text = "Select at least 1 rune first!";
        resultText.color = k.rgb(255, 150, 150);
        return;
      }
      if (state.player.manaCrystals < 5) {
        resultText.text = "Not enough crystals! Need 5.";
        resultText.color = k.rgb(255, 150, 150);
        return;
      }

      const spell = craftSpell([...selectedRunes]);
      if (spell) {
        resultText.text = `Crafted: ${spell.name} (${spell.power} power, ${spell.manaCost} mana cost)`;
        resultText.color = k.rgb(200, 255, 200);
        selectedRunes.length = 0;
        updateSelectedDisplay();
      } else {
        resultText.text = "Crafting failed!";
        resultText.color = k.rgb(255, 150, 150);
      }
    });

    craftBtn.onHover(() => { craftBtn.color = k.rgb(110, 70, 45); });
    craftBtn.onHoverEnd(() => { craftBtn.color = k.rgb(80, 50, 30); });

    // Clear button
    const clearBtn = k.add([
      k.rect(100, 45, { radius: 6 }),
      k.pos(260, actionY),
      k.color(60, 40, 40),
      k.area(),
    ]);

    k.add([
      k.text("Clear", { size: 14 }),
      k.pos(310, actionY + 22),
      k.anchor("center"),
      k.color(200, 160, 160),
    ]);

    clearBtn.onClick(() => {
      selectedRunes.length = 0;
      updateSelectedDisplay();
      resultText.text = "";
    });

    // === CURRENT SPELLS ===
    k.add([
      k.text("Your Spells:", { size: 16 }),
      k.pos(500, actionY),
      k.color(200, 180, 150),
    ]);

    const spellListY = actionY + 25;
    const visibleSpells = state.player.spellPool.slice(0, 6);
    visibleSpells.forEach((spell, i) => {
      k.add([
        k.text(`${spell.name} - ${spell.power}pow / ${spell.manaCost}mp`, { size: 12 }),
        k.pos(500, spellListY + i * 20),
        k.color(170, 170, 200),
      ]);
    });

    if (state.player.spellPool.length > 6) {
      k.add([
        k.text(`... and ${state.player.spellPool.length - 6} more`, { size: 11 }),
        k.pos(500, spellListY + 6 * 20),
        k.color(120, 120, 150),
      ]);
    }

    // === PREPARED SLOTS ===
    k.add([
      k.text("Prepared Slots:", { size: 14 }),
      k.pos(500, spellListY + 160),
      k.color(200, 180, 150),
    ]);

    state.player.preparedSlots.forEach((slot, i) => {
      const label = slot ? slot.name : "(empty)";
      k.add([
        k.text(`Slot ${i + 1}: ${label}`, { size: 12 }),
        k.pos(500, spellListY + 180 + i * 18),
        k.color(slot ? [170, 200, 170] : [100, 100, 120]),
      ]);
    });

    // === BACK BUTTON ===
    const backBtn = k.add([
      k.rect(140, 40, { radius: 6 }),
      k.pos(k.width() / 2, k.height() - 50),
      k.anchor("center"),
      k.color(40, 50, 60),
      k.area(),
    ]);

    k.add([
      k.text("Leave Forge", { size: 16 }),
      k.pos(k.width() / 2, k.height() - 50),
      k.anchor("center"),
      k.color(200, 200, 220),
    ]);

    backBtn.onClick(() => { k.go("game"); });
    backBtn.onHover(() => { backBtn.color = k.rgb(55, 65, 80); });
    backBtn.onHoverEnd(() => { backBtn.color = k.rgb(40, 50, 60); });

    k.onKeyPress("escape", () => { k.go("game"); });
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) || 100,
    parseInt(h.substring(2, 4), 16) || 100,
    parseInt(h.substring(4, 6), 16) || 100,
  ];
}
