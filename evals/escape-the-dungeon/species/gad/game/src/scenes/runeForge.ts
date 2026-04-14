import type { KAPLAYCtx } from "kaplay";
import { getGameState, craftSpell } from "../systems/gameState";
import { RUNES } from "../content/runes";

export function loadRuneForgeScene(k: KAPLAYCtx) {
  k.scene("runeForge", () => {
    const state = getGameState();

    let selectedRunes: string[] = [];
    const MAX_RUNES = 4;

    // Background
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(25, 15, 35)]);

    // Title
    k.add([
      k.text("RUNE FORGE", { size: 32 }),
      k.pos(k.width() / 2, 30),
      k.anchor("center"),
      k.color(200, 100, 255),
    ]);

    k.add([
      k.text("Select runes to craft a spell (1-4 runes). Cost: 5 crystals.", { size: 16 }),
      k.pos(k.width() / 2, 65),
      k.anchor("center"),
      k.color(160, 140, 180),
    ]);

    k.add([
      k.text(`Crystals: ${state.player.manaCrystals}`, { size: 16 }),
      k.pos(k.width() / 2, 88),
      k.anchor("center"),
      k.color(255, 215, 0),
    ]);

    // Selected runes display
    const selectionY = 110;

    k.add([
      k.text("Selected:", { size: 18 }),
      k.pos(40, selectionY),
      k.color(180, 160, 200),
    ]);

    const selectedDisplay = k.add([
      k.text("(none)", { size: 20 }),
      k.pos(150, selectionY),
      k.color(255, 200, 255),
    ]);

    // Rune grid
    const gridStartX = 40;
    const gridStartY = 150;
    const runeSize = 70;
    const runeGap = 8;
    const runesPerRow = 13;

    const runeButtons: ReturnType<typeof k.add>[] = [];
    const runeLabels: ReturnType<typeof k.add>[] = [];

    RUNES.forEach((rune, i) => {
      const row = Math.floor(i / runesPerRow);
      const col = i % runesPerRow;
      const rx = gridStartX + col * (runeSize + runeGap);
      const ry = gridStartY + row * (runeSize + runeGap + 20);

      // Parse hex color
      const hex = rune.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      const btn = k.add([
        k.rect(runeSize, runeSize, { radius: 8 }),
        k.pos(rx, ry),
        k.color(r * 0.4, g * 0.4, b * 0.4),
        k.area(),
        `rune_btn_${rune.runeId}`,
      ]);

      // Rune symbol
      k.add([
        k.text(rune.symbol, { size: 28 }),
        k.pos(rx + runeSize / 2, ry + 20),
        k.anchor("center"),
        k.color(r, g, b),
      ]);

      // Rune name
      k.add([
        k.text(rune.name, { size: 10 }),
        k.pos(rx + runeSize / 2, ry + 48),
        k.anchor("center"),
        k.color(160, 160, 180),
      ]);

      // Affinity
      const affinity = state.player.runeAffinities[rune.runeId] || 0;
      k.add([
        k.text(`Aff: ${affinity}`, { size: 9 }),
        k.pos(rx + runeSize / 2, ry + 60),
        k.anchor("center"),
        k.color(120, 120, 140),
      ]);

      btn.onClick(() => {
        if (selectedRunes.includes(rune.runeId)) {
          // Deselect
          selectedRunes = selectedRunes.filter((id) => id !== rune.runeId);
          btn.color = k.rgb(r * 0.4, g * 0.4, b * 0.4);
        } else if (selectedRunes.length < MAX_RUNES) {
          // Select
          selectedRunes.push(rune.runeId);
          btn.color = k.rgb(r * 0.8, g * 0.8, b * 0.8);
        }

        // Update display
        if (selectedRunes.length === 0) {
          selectedDisplay.text = "(none)";
        } else {
          selectedDisplay.text = selectedRunes
            .map((id) => RUNES.find((r) => r.runeId === id)?.name || "?")
            .join(" + ");
        }
      });

      btn.onHover(() => {
        if (!selectedRunes.includes(rune.runeId)) {
          btn.color = k.rgb(r * 0.6, g * 0.6, b * 0.6);
        }
      });
      btn.onHoverEnd(() => {
        if (!selectedRunes.includes(rune.runeId)) {
          btn.color = k.rgb(r * 0.4, g * 0.4, b * 0.4);
        }
      });

      runeButtons.push(btn);
    });

    // === Prepared slots display ===
    const slotsY = 400;

    k.add([
      k.text("Prepared Spell Slots:", { size: 18 }),
      k.pos(40, slotsY),
      k.color(180, 160, 200),
    ]);

    state.player.preparedSlots.forEach((slot, i) => {
      const label = slot ? `[${i + 1}] ${slot.name} (${slot.manaCost} mana)` : `[${i + 1}] Empty`;
      k.add([
        k.text(label, { size: 14 }),
        k.pos(60, slotsY + 28 + i * 22),
        k.color(slot ? [200, 200, 255] : [100, 100, 120]),
      ]);
    });

    // === Known spells ===
    const spellsY = slotsY + 28 + state.player.preparedSlots.length * 22 + 20;

    k.add([
      k.text("Known Spells:", { size: 18 }),
      k.pos(40, spellsY),
      k.color(180, 160, 200),
    ]);

    state.player.spellPool.forEach((spell, i) => {
      const isPrepared = state.player.preparedSlots.some((s) => s?.spellId === spell.spellId);
      k.add([
        k.text(
          `${spell.name} [${spell.runeCombo.map((id) => RUNES.find((r) => r.runeId === id)?.symbol || "?").join("")}] - Power: ${spell.power} - ${spell.manaCost} mana${isPrepared ? " [PREPARED]" : ""}`,
          { size: 13 }
        ),
        k.pos(60, spellsY + 28 + i * 22),
        k.color(isPrepared ? [160, 200, 255] : [160, 160, 180]),
      ]);
    });

    // === Action buttons ===
    const btnY = k.height() - 60;

    // Craft button
    const craftBtn = k.add([
      k.rect(160, 40, { radius: 6 }),
      k.pos(k.width() / 2 - 200, btnY),
      k.anchor("center"),
      k.color(80, 40, 120),
      k.area(),
    ]);

    k.add([
      k.text("Craft Spell (5 cr.)", { size: 16 }),
      k.pos(k.width() / 2 - 200, btnY),
      k.anchor("center"),
      k.color(200, 180, 255),
    ]);

    craftBtn.onClick(() => {
      if (selectedRunes.length === 0) return;
      if (state.player.manaCrystals < 5) {
        // Show insufficient funds
        return;
      }

      const spell = craftSpell(selectedRunes);
      if (spell) {
        // Assign to empty slot if available
        const emptyIdx = state.player.preparedSlots.findIndex((s) => s === null);
        if (emptyIdx >= 0) {
          state.player.preparedSlots[emptyIdx] = spell;
        }

        // Refresh scene
        k.go("runeForge");
      }
    });

    // Back button
    const backBtn = k.add([
      k.rect(120, 40, { radius: 6 }),
      k.pos(k.width() / 2 + 200, btnY),
      k.anchor("center"),
      k.color(60, 60, 80),
      k.area(),
    ]);

    k.add([
      k.text("Back", { size: 18 }),
      k.pos(k.width() / 2 + 200, btnY),
      k.anchor("center"),
      k.color(200, 200, 220),
    ]);

    backBtn.onClick(() => {
      k.go("game");
    });

    k.onKeyPress("escape", () => {
      k.go("game");
    });
  });
}
