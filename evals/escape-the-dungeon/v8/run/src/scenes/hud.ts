// HUD drawing utilities
import type { KAPLAYCtx } from "kaplay";
import type { PlayerState } from "../types";

export function drawHUD(k: KAPLAYCtx, player: PlayerState) {
  const W = k.width();

  // HUD background bar
  k.add([
    k.rect(W, 55),
    k.pos(0, 0),
    k.color(15, 17, 32),
    k.opacity(0.95),
  ]);

  // Player name and level
  k.add([
    k.text(`${player.name}  Lv.${player.level}`, { size: 14, font: "monospace" }),
    k.pos(12, 6),
    k.color(200, 210, 240),
  ]);

  // HP Bar
  drawBar(k, 12, 26, 180, 12, player.stats.currentHp, player.stats.maxHp, [220, 50, 50], [80, 20, 20], "HP");

  // Mana Bar
  drawBar(k, 12, 42, 180, 10, player.stats.currentMana, player.stats.maxMana, [50, 100, 220], [20, 30, 80], "MP");

  // XP Bar (smaller, dimmer)
  drawBar(k, 200, 26, 120, 8, player.xp, player.xpToNext, [255, 200, 50], [60, 50, 20], "XP");

  // Crystals
  k.add([
    k.text(`\u{1F48E} ${player.crystals}`, { size: 12, font: "monospace" }),
    k.pos(200, 40),
    k.color(140, 180, 255),
  ]);

  // Floor and tick
  k.add([
    k.text(`Floor ${player.currentFloor}`, { size: 12, font: "monospace" }),
    k.pos(W - 120, 8),
    k.color(140, 145, 170),
  ]);

  k.add([
    k.text(`Tick ${player.tick}`, { size: 12, font: "monospace" }),
    k.pos(W - 120, 26),
    k.color(100, 105, 130),
  ]);

  // Rune count
  k.add([
    k.text(`\u{1FA78} ${player.runes.length} Runes`, { size: 12, font: "monospace" }),
    k.pos(W - 120, 42),
    k.color(160, 120, 200),
  ]);
}

export function drawBar(
  k: KAPLAYCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  current: number,
  max: number,
  fillColor: [number, number, number],
  bgColor: [number, number, number],
  label: string,
) {
  // Background
  k.add([
    k.rect(w, h, { radius: h / 2 }),
    k.pos(x, y),
    k.color(...bgColor),
  ]);

  // Fill
  const fillW = Math.max(1, (current / Math.max(max, 1)) * w);
  if (fillW > 0) {
    k.add([
      k.rect(fillW, h, { radius: h / 2 }),
      k.pos(x, y),
      k.color(...fillColor),
    ]);
  }

  // Label
  k.add([
    k.text(`${label} ${current}/${max}`, { size: Math.min(h, 10), font: "monospace" }),
    k.pos(x + 4, y + (h > 10 ? 1 : 0)),
    k.color(255, 255, 255),
  ]);
}

export function drawCombatBar(
  k: KAPLAYCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  current: number,
  max: number,
  fillColor: [number, number, number],
  bgColor: [number, number, number],
  label: string,
) {
  // Background
  k.add([
    k.rect(w, h, { radius: 4 }),
    k.pos(x, y),
    k.color(...bgColor),
    k.outline(1, k.Color.fromArray([60, 65, 90])),
  ]);

  // Fill
  const fillW = Math.max(0, (current / Math.max(max, 1)) * (w - 2));
  if (fillW > 0) {
    k.add([
      k.rect(fillW, h - 2, { radius: 3 }),
      k.pos(x + 1, y + 1),
      k.color(...fillColor),
    ]);
  }

  // Label text
  k.add([
    k.text(`${label}: ${current}/${max}`, { size: 14, font: "monospace" }),
    k.pos(x + 6, y + (h - 14) / 2),
    k.color(255, 255, 255),
  ]);
}
