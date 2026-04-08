import type { KAPLAYCtx, GameObj } from "kaplay";

// UI helper functions for consistent button/text creation
// Inherited skill: kaplay-scene-pattern -- tag everything, destroyAll before re-render

const COLORS = {
  bg: [30, 30, 45] as [number, number, number],
  panel: [40, 40, 60] as [number, number, number],
  panelLight: [55, 55, 80] as [number, number, number],
  text: [220, 220, 230] as [number, number, number],
  textDim: [150, 150, 170] as [number, number, number],
  accent: [100, 180, 255] as [number, number, number],
  danger: [255, 80, 80] as [number, number, number],
  success: [80, 220, 120] as [number, number, number],
  warning: [255, 200, 60] as [number, number, number],
  hp: [220, 50, 50] as [number, number, number],
  mana: [60, 120, 255] as [number, number, number],
  gold: [255, 215, 0] as [number, number, number],
};

export { COLORS };

export function makeButton(
  k: KAPLAYCtx,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  tag: string,
  onClick: () => void,
  color?: [number, number, number]
): GameObj {
  const btnColor = color ?? COLORS.accent;
  const btn = k.add([
    k.rect(width, height, { radius: 6 }),
    k.pos(x, y),
    k.anchor("center"),
    k.area(),
    k.color(...btnColor),
    k.opacity(1),
    tag,
  ]);

  // Button text
  k.add([
    k.text(label, { size: 18 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(...COLORS.text),
    tag,
  ]);

  // Hover effects
  btn.onHoverUpdate(() => {
    btn.opacity = 0.8;
    k.setCursor("pointer");
  });
  btn.onHoverEnd(() => {
    btn.opacity = 1;
    k.setCursor("default");
  });

  btn.onClick(onClick);

  return btn;
}

export function makeText(
  k: KAPLAYCtx,
  content: string,
  x: number,
  y: number,
  tag: string,
  opts?: { size?: number; color?: [number, number, number]; anchor?: string; width?: number }
): GameObj {
  return k.add([
    k.text(content, { size: opts?.size ?? 16, width: opts?.width }),
    k.pos(x, y),
    k.anchor((opts?.anchor as any) ?? "center"),
    k.color(...(opts?.color ?? COLORS.text)),
    tag,
  ]);
}

export function makePanel(
  k: KAPLAYCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  tag: string,
  color?: [number, number, number]
): GameObj {
  return k.add([
    k.rect(w, h, { radius: 8 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(...(color ?? COLORS.panel)),
    k.opacity(0.9),
    tag,
  ]);
}

export function makeHpBar(
  k: KAPLAYCtx,
  x: number,
  y: number,
  width: number,
  current: number,
  max: number,
  tag: string,
  color?: [number, number, number]
): void {
  const barHeight = 14;
  const ratio = Math.max(0, current / max);

  // Background
  k.add([
    k.rect(width, barHeight, { radius: 3 }),
    k.pos(x, y),
    k.anchor("left"),
    k.color(60, 60, 60),
    tag,
  ]);

  // Fill
  if (ratio > 0) {
    k.add([
      k.rect(width * ratio, barHeight, { radius: 3 }),
      k.pos(x, y),
      k.anchor("left"),
      k.color(...(color ?? COLORS.hp)),
      tag,
    ]);
  }

  // Text
  k.add([
    k.text(`${current}/${max}`, { size: 11 }),
    k.pos(x + width / 2, y),
    k.anchor("center"),
    k.color(...COLORS.text),
    tag,
  ]);
}
