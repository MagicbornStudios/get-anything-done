import kaplay from "kaplay";

// Re-export the kaplay instance - initialized once in main.ts
// This module provides UI helper functions that work with the global kaplay context.

const BUTTON_COLOR = { r: 60, g: 60, b: 120 };
const BUTTON_HOVER = { r: 80, g: 80, b: 160 };
const BUTTON_TEXT_COLOR = { r: 255, g: 255, b: 255 };

export interface ButtonOpts {
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  onClick: () => void;
  fontSize?: number;
}

/**
 * Creates a clickable button as a game object.
 * Uses KAPLAY's add() with rect, text, area, and anchor components.
 */
export function makeButton(k: any, opts: ButtonOpts) {
  const w = opts.width ?? 220;
  const h = opts.height ?? 48;
  const fs = opts.fontSize ?? 20;

  const btn = k.add([
    k.rect(w, h, { radius: 6 }),
    k.pos(opts.x, opts.y),
    k.color(BUTTON_COLOR.r, BUTTON_COLOR.g, BUTTON_COLOR.b),
    k.anchor("center"),
    k.area(),
    k.z(10),
    "button",
  ]);

  const label = btn.add([
    k.text(opts.label, { size: fs }),
    k.anchor("center"),
    k.color(BUTTON_TEXT_COLOR.r, BUTTON_TEXT_COLOR.g, BUTTON_TEXT_COLOR.b),
    k.z(11),
  ]);

  btn.onHover(() => {
    btn.color = k.rgb(BUTTON_HOVER.r, BUTTON_HOVER.g, BUTTON_HOVER.b);
  });

  btn.onHoverEnd(() => {
    btn.color = k.rgb(BUTTON_COLOR.r, BUTTON_COLOR.g, BUTTON_COLOR.b);
  });

  btn.onClick(() => {
    opts.onClick();
  });

  return btn;
}

/**
 * Draw a colored bar (HP/Mana) as a game object.
 */
export function makeBar(
  k: any,
  x: number,
  y: number,
  width: number,
  height: number,
  current: number,
  max: number,
  fgColor: [number, number, number],
  bgColor: [number, number, number] = [40, 40, 40]
) {
  // Background
  const bg = k.add([
    k.rect(width, height, { radius: 3 }),
    k.pos(x, y),
    k.color(bgColor[0], bgColor[1], bgColor[2]),
    k.anchor("left"),
    k.z(5),
  ]);

  // Foreground
  const ratio = Math.max(0, Math.min(1, current / max));
  const fg = k.add([
    k.rect(width * ratio, height, { radius: 3 }),
    k.pos(x, y),
    k.color(fgColor[0], fgColor[1], fgColor[2]),
    k.anchor("left"),
    k.z(6),
  ]);

  return { bg, fg };
}

/**
 * Add centered text.
 */
export function addCenteredText(
  k: any,
  content: string,
  y: number,
  size: number = 24,
  col: [number, number, number] = [255, 255, 255]
) {
  return k.add([
    k.text(content, { size, width: k.width() - 40 }),
    k.pos(k.width() / 2, y),
    k.anchor("center"),
    k.color(col[0], col[1], col[2]),
    k.z(10),
  ]);
}
