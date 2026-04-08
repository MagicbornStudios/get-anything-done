// Rune Forge scene - spell crafting (GATE G2)
import type { KAPLAYCtx } from "kaplay";
import { getPlayer, addSpell, saveGame } from "../systems/gamestate";
import { RUNES, SPELLS } from "../data/content";
import type { Spell } from "../types";

let selectedRunes: string[] = [];
let craftResult: Spell | null = null;
let craftMessage: string = "";

export function forgeScene(k: KAPLAYCtx) {
  selectedRunes = [];
  craftResult = null;
  craftMessage = "";

  renderForge(k);
}

function renderForge(k: KAPLAYCtx) {
  k.destroyAll("*");

  const W = k.width();
  const H = k.height();
  const player = getPlayer();

  // Background
  k.add([
    k.rect(W, H),
    k.pos(0, 0),
    k.color(18, 10, 22),
    "fg",
  ]);

  // Title bar
  k.add([
    k.rect(W, 45),
    k.pos(0, 0),
    k.color(25, 15, 30),
    "fg",
  ]);
  k.add([
    k.rect(W, 3),
    k.pos(0, 42),
    k.color(160, 60, 200),
    "fg",
  ]);
  k.add([
    k.text("\u{2728} RUNE FORGE", { size: 22, font: "monospace" }),
    k.pos(15, 10),
    k.color(200, 150, 255),
    "fg",
  ]);

  // Instructions
  k.add([
    k.text("Select two runes to combine into a powerful spell", { size: 13, font: "monospace" }),
    k.pos(20, 55),
    k.color(140, 120, 170),
    "fg",
  ]);

  // Available runes panel
  k.add([
    k.rect(W - 40, 160, { radius: 10 }),
    k.pos(20, 80),
    k.color(22, 15, 28),
    k.outline(2, k.Color.fromArray([100, 50, 130])),
    "fg",
  ]);

  k.add([
    k.text("YOUR RUNES", { size: 12, font: "monospace" }),
    k.pos(35, 88),
    k.color(140, 100, 180),
    "fg",
  ]);

  // Show player's runes as clickable buttons
  const playerRunes = player.runes;
  const runeW = 120;
  const runeH = 80;
  const startX = 35;
  const startY = 110;

  if (playerRunes.length === 0) {
    k.add([
      k.text("No runes collected yet. Explore the dungeon to find runes!", { size: 13, font: "monospace" }),
      k.pos(startX, startY + 20),
      k.color(120, 100, 140),
      "fg",
    ]);
  }

  playerRunes.forEach((runeId, i) => {
    const rune = RUNES[runeId];
    if (!rune) return;

    const rx = startX + (i % 7) * (runeW + 10);
    const ry = startY + Math.floor(i / 7) * (runeH + 10);
    const isSelected = selectedRunes.includes(runeId);
    const selCount = selectedRunes.filter(r => r === runeId).length;
    const maxSelectable = playerRunes.filter(r => r === runeId).length;
    // For simplicity, each rune type can be selected up to twice (same rune combos allowed)

    const bg = k.add([
      k.rect(runeW, runeH, { radius: 8 }),
      k.pos(rx, ry),
      k.color(isSelected ? 40 : 28, isSelected ? 25 : 18, isSelected ? 50 : 35),
      k.outline(2, k.Color.fromHex(isSelected ? "#ffffff" : rune.color)),
      k.area(),
      "rune-btn",
    ]);

    // Rune icon
    k.add([
      k.text(rune.icon, { size: 28 }),
      k.pos(rx + runeW / 2, ry + 22),
      k.anchor("center"),
      "fg",
    ]);

    // Rune name
    k.add([
      k.text(rune.name.replace(" Rune", ""), { size: 11, font: "monospace" }),
      k.pos(rx + runeW / 2, ry + 50),
      k.anchor("center"),
      k.color(k.Color.fromHex(rune.color)),
      "fg",
    ]);

    // Selection indicator
    if (isSelected) {
      k.add([
        k.text("\u{2705}", { size: 14 }),
        k.pos(rx + runeW - 18, ry + 4),
        "fg",
      ]);
    }

    bg.onHoverUpdate(() => {
      bg.color = k.Color.fromArray([45, 30, 55]);
      k.setCursor("pointer");
    });
    bg.onHoverEnd(() => {
      bg.color = k.Color.fromArray([isSelected ? 40 : 28, isSelected ? 25 : 18, isSelected ? 50 : 35]);
      k.setCursor("default");
    });

    bg.onClick(() => {
      if (isSelected) {
        // Deselect
        const idx = selectedRunes.indexOf(runeId);
        if (idx >= 0) selectedRunes.splice(idx, 1);
      } else if (selectedRunes.length < 2) {
        selectedRunes.push(runeId);
      }
      craftResult = null;
      craftMessage = "";
      renderForge(k);
    });
  });

  // Crafting area
  const craftY = 255;
  k.add([
    k.rect(W - 40, 130, { radius: 10 }),
    k.pos(20, craftY),
    k.color(20, 12, 25),
    k.outline(2, k.Color.fromArray([130, 80, 180])),
    "fg",
  ]);

  k.add([
    k.text("FORGE", { size: 14, font: "monospace" }),
    k.pos(35, craftY + 8),
    k.color(180, 130, 230),
    "fg",
  ]);

  // Selected rune slots
  const slot1X = W / 2 - 120;
  const slot2X = W / 2 + 20;
  const slotY = craftY + 35;

  // Slot 1
  drawRuneSlot(k, slot1X, slotY, selectedRunes[0] ?? null, "Rune 1");

  // Plus sign
  k.add([
    k.text("+", { size: 28, font: "monospace" }),
    k.pos(W / 2, slotY + 25),
    k.anchor("center"),
    k.color(180, 140, 220),
    "fg",
  ]);

  // Slot 2
  drawRuneSlot(k, slot2X, slotY, selectedRunes[1] ?? null, "Rune 2");

  // Craft button
  if (selectedRunes.length === 2) {
    const craftBtn = k.add([
      k.rect(200, 44, { radius: 8 }),
      k.pos(W / 2, craftY + 100),
      k.anchor("center"),
      k.color(50, 20, 70),
      k.outline(2, k.Color.fromArray([200, 100, 255])),
      k.area(),
      "craft-btn",
    ]);
    k.add([
      k.text("\u{2728} CRAFT SPELL \u{2728}", { size: 16, font: "monospace" }),
      k.pos(W / 2, craftY + 100),
      k.anchor("center"),
      k.color(255, 200, 255),
      "fg",
    ]);

    craftBtn.onHoverUpdate(() => {
      craftBtn.color = k.Color.fromArray([70, 30, 100]);
      k.setCursor("pointer");
    });
    craftBtn.onHoverEnd(() => {
      craftBtn.color = k.Color.fromArray([50, 20, 70]);
      k.setCursor("default");
    });
    craftBtn.onClick(() => {
      attemptCraft(k);
    });
  }

  // Result area
  const resultY = 400;
  if (craftResult) {
    k.add([
      k.rect(W - 40, 80, { radius: 10 }),
      k.pos(20, resultY),
      k.color(15, 25, 15),
      k.outline(2, k.Color.fromArray([80, 200, 80])),
      "fg",
    ]);

    k.add([
      k.text(`\u{2705} Spell Crafted: ${craftResult.icon} ${craftResult.name}!`, { size: 18, font: "monospace" }),
      k.pos(35, resultY + 10),
      k.color(100, 255, 100),
      "fg",
    ]);
    k.add([
      k.text(`${craftResult.description}  |  ${craftResult.damage} DMG  |  ${craftResult.manaCost} MP`, { size: 13, font: "monospace" }),
      k.pos(35, resultY + 35),
      k.color(150, 200, 150),
      "fg",
    ]);
    k.add([
      k.text("This spell is now available in combat!", { size: 12, font: "monospace" }),
      k.pos(35, resultY + 58),
      k.color(120, 180, 120),
      "fg",
    ]);
  } else if (craftMessage) {
    k.add([
      k.rect(W - 40, 50, { radius: 8 }),
      k.pos(20, resultY),
      k.color(30, 15, 15),
      k.outline(1, k.Color.fromArray([180, 80, 80])),
      "fg",
    ]);
    k.add([
      k.text(craftMessage, { size: 14, font: "monospace" }),
      k.pos(35, resultY + 16),
      k.color(220, 120, 120),
      "fg",
    ]);
  }

  // Known spells section
  const spellsY = craftResult ? 495 : (craftMessage ? 465 : 410);
  k.add([
    k.text("KNOWN SPELLS", { size: 12, font: "monospace" }),
    k.pos(25, spellsY),
    k.color(130, 100, 170),
    "fg",
  ]);

  player.spells.forEach((spellId, i) => {
    const spell = SPELLS[spellId];
    if (!spell) return;
    k.add([
      k.text(`${spell.icon} ${spell.name} - ${spell.damage} DMG, ${spell.manaCost} MP`, { size: 12, font: "monospace" }),
      k.pos(25, spellsY + 18 + i * 18),
      k.color(k.Color.fromHex(spell.color)),
      "fg",
    ]);
  });

  // Back button
  const backBtn = k.add([
    k.rect(180, 40, { radius: 6 }),
    k.pos(W / 2, H - 30),
    k.anchor("center"),
    k.color(25, 25, 40),
    k.outline(2, k.Color.fromArray([80, 80, 120])),
    k.area(),
    "back-btn",
  ]);
  k.add([
    k.text("\u{2B05}\u{FE0F} Return to Dungeon", { size: 14, font: "monospace" }),
    k.pos(W / 2, H - 30),
    k.anchor("center"),
    k.color(180, 180, 210),
    "fg",
  ]);
  backBtn.onHoverUpdate(() => {
    backBtn.color = k.Color.fromArray([40, 40, 60]);
    k.setCursor("pointer");
  });
  backBtn.onHoverEnd(() => {
    backBtn.color = k.Color.fromArray([25, 25, 40]);
    k.setCursor("default");
  });
  backBtn.onClick(() => {
    saveGame();
    k.go("room");
  });
}

function drawRuneSlot(k: KAPLAYCtx, x: number, y: number, runeId: string | null, label: string) {
  const rune = runeId ? RUNES[runeId] : null;

  k.add([
    k.rect(90, 60, { radius: 6 }),
    k.pos(x, y),
    k.color(rune ? 35 : 20, rune ? 20 : 15, rune ? 45 : 25),
    k.outline(2, rune ? k.Color.fromHex(rune.color) : k.Color.fromArray([60, 50, 80])),
    "fg",
  ]);

  if (rune) {
    k.add([
      k.text(rune.icon, { size: 24 }),
      k.pos(x + 45, y + 18),
      k.anchor("center"),
      "fg",
    ]);
    k.add([
      k.text(rune.name.replace(" Rune", ""), { size: 10, font: "monospace" }),
      k.pos(x + 45, y + 42),
      k.anchor("center"),
      k.color(k.Color.fromHex(rune.color)),
      "fg",
    ]);
  } else {
    k.add([
      k.text(label, { size: 11, font: "monospace" }),
      k.pos(x + 45, y + 25),
      k.anchor("center"),
      k.color(80, 70, 100),
      "fg",
    ]);
  }
}

function attemptCraft(k: KAPLAYCtx) {
  if (selectedRunes.length !== 2) return;

  const player = getPlayer();
  const [r1, r2] = selectedRunes;

  // Find matching recipe
  const matchingSpell = Object.values(SPELLS).find(spell => {
    const [a, b] = spell.runeRecipe;
    return (a === r1 && b === r2) || (a === r2 && b === r1);
  });

  if (!matchingSpell) {
    craftMessage = "These runes don't combine into anything. Try a different combination!";
    craftResult = null;
    renderForge(k);
    return;
  }

  if (player.spells.includes(matchingSpell.id)) {
    craftMessage = `You already know ${matchingSpell.name}! Try a different combination.`;
    craftResult = null;
    renderForge(k);
    return;
  }

  // Success!
  addSpell(matchingSpell.id);
  craftResult = matchingSpell;
  craftMessage = "";
  selectedRunes = [];
  saveGame();
  renderForge(k);
}
