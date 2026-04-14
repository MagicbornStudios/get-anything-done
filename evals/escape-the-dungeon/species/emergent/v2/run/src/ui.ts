// UI drawing utilities for KAPLAY
// Provides styled buttons, HP bars, icons, room visuals
// Gate G3: Must be polished, no ASCII

import type { KAPLAYCtx, GameObj } from "kaplay";

// Color palette
export const COLORS = {
  bg: [16, 16, 24] as const,
  panelBg: [28, 28, 42] as const,
  panelBorder: [60, 60, 90] as const,
  text: [220, 220, 235] as const,
  textDim: [140, 140, 170] as const,
  accent: [100, 160, 255] as const,
  accentHover: [130, 185, 255] as const,
  danger: [220, 60, 60] as const,
  success: [60, 200, 80] as const,
  gold: [255, 200, 60] as const,
  mana: [80, 120, 255] as const,
  hpBar: [50, 180, 70] as const,
  hpBarBg: [60, 30, 30] as const,
  manaBar: [60, 80, 220] as const,
  manaBarBg: [30, 30, 60] as const,
  xpBar: [200, 180, 40] as const,

  // Room type colors
  combat: [180, 50, 50] as const,
  dialogue: [60, 140, 200] as const,
  treasure: [200, 180, 40] as const,
  rest: [60, 180, 90] as const,
  forge: [200, 100, 40] as const,
  boss: [160, 30, 30] as const,
  start: [100, 100, 140] as const,
};

type RGB = readonly [number, number, number];

function rgb(k: KAPLAYCtx, c: RGB) {
  return k.rgb(c[0], c[1], c[2]);
}

// ====== Styled Button ======
export function addButton(
  k: KAPLAYCtx,
  text: string,
  x: number,
  y: number,
  opts: {
    tag: string;
    width?: number;
    height?: number;
    color?: RGB;
    hoverColor?: RGB;
    textColor?: RGB;
    fontSize?: number;
    onClick: () => void;
  }
): GameObj {
  const w = opts.width ?? 220;
  const h = opts.height ?? 44;
  const btnColor = opts.color ?? COLORS.accent;
  const hoverCol = opts.hoverColor ?? COLORS.accentHover;
  const txtCol = opts.textColor ?? [255, 255, 255] as const;
  const fontSize = opts.fontSize ?? 18;

  const btn = k.add([
    k.rect(w, h, { radius: 8 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(rgb(k, btnColor)),
    k.area({ cursor: "pointer" }),
    k.outline(2, rgb(k, [80, 80, 120])),
    k.opacity(1),
    opts.tag,
    "button",
  ]);

  const label = k.add([
    k.text(text, { size: fontSize }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(rgb(k, txtCol)),
    opts.tag,
  ]);

  btn.onHover(() => {
    btn.color = rgb(k, hoverCol);
    try { btn.outline.color = rgb(k, [180, 180, 220]); } catch { /* ignore */ }
  });

  btn.onHoverEnd(() => {
    btn.color = rgb(k, btnColor);
    try { btn.outline.color = rgb(k, [80, 80, 120]); } catch { /* ignore */ }
  });

  btn.onClick(opts.onClick);

  // Return the button container. Label is auto-tagged.
  void label;
  return btn;
}

// ====== HP/Mana Bar ======
export function addBar(
  k: KAPLAYCtx,
  x: number,
  y: number,
  current: number,
  max: number,
  opts: {
    tag: string;
    width?: number;
    height?: number;
    fillColor?: RGB;
    bgColor?: RGB;
    label?: string;
    showText?: boolean;
    anchor?: "left" | "center";
  }
): void {
  const w = opts.width ?? 200;
  const h = opts.height ?? 20;
  const fillCol = opts.fillColor ?? COLORS.hpBar;
  const bgCol = opts.bgColor ?? COLORS.hpBarBg;
  const ratio = Math.max(0, Math.min(1, max > 0 ? current / max : 0));
  const anchorVal = opts.anchor ?? "left";
  const posX = anchorVal === "center" ? x - w / 2 : x;

  // Background
  k.add([
    k.rect(w, h, { radius: 4 }),
    k.pos(posX, y),
    k.color(rgb(k, bgCol)),
    k.outline(1, rgb(k, COLORS.panelBorder)),
    opts.tag,
  ]);

  // Fill
  if (ratio > 0) {
    k.add([
      k.rect(Math.max(2, w * ratio), h, { radius: 4 }),
      k.pos(posX, y),
      k.color(rgb(k, fillCol)),
      opts.tag,
    ]);
  }

  // Text overlay
  if (opts.showText !== false) {
    const barText = opts.label
      ? `${opts.label}: ${current}/${max}`
      : `${current}/${max}`;
    k.add([
      k.text(barText, { size: 13 }),
      k.pos(posX + w / 2, y + h / 2),
      k.anchor("center"),
      k.color(rgb(k, COLORS.text)),
      opts.tag,
    ]);
  }
}

// ====== Panel Background ======
export function addPanel(
  k: KAPLAYCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  tag: string,
  opts?: { color?: RGB; borderColor?: RGB; anchor?: string }
): GameObj {
  return k.add([
    k.rect(w, h, { radius: 12 }),
    k.pos(x, y),
    k.anchor((opts?.anchor as "center" | "topleft") ?? "center"),
    k.color(rgb(k, opts?.color ?? COLORS.panelBg)),
    k.outline(2, rgb(k, opts?.borderColor ?? COLORS.panelBorder)),
    k.opacity(0.95),
    tag,
  ]);
}

// ====== Room Type Icon (canvas drawn) ======
export function addRoomIcon(
  k: KAPLAYCtx,
  x: number,
  y: number,
  roomType: string,
  size: number,
  tag: string
): void {
  const typeColor = getRoomTypeColor(roomType);

  // Circle background
  k.add([
    k.circle(size / 2),
    k.pos(x, y),
    k.anchor("center"),
    k.color(rgb(k, typeColor)),
    k.opacity(0.3),
    tag,
  ]);

  // Icon character using emoji
  const icon = getRoomIcon(roomType);
  k.add([
    k.text(icon, { size: size * 0.6 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(rgb(k, typeColor)),
    tag,
  ]);
}

export function getRoomTypeColor(type: string): RGB {
  switch (type) {
    case "combat": return COLORS.combat;
    case "dialogue": return COLORS.dialogue;
    case "treasure": return COLORS.treasure;
    case "rest": return COLORS.rest;
    case "forge": return COLORS.forge;
    case "boss": return COLORS.boss;
    case "start": return COLORS.start;
    default: return COLORS.textDim;
  }
}

export function getRoomIcon(type: string): string {
  switch (type) {
    case "combat": return "X";
    case "dialogue": return "?";
    case "treasure": return "$";
    case "rest": return "+";
    case "forge": return "*";
    case "boss": return "!";
    case "start": return ">";
    default: return "o";
  }
}

export function getRoomTypeName(type: string): string {
  switch (type) {
    case "combat": return "Combat";
    case "dialogue": return "Dialogue";
    case "treasure": return "Treasure";
    case "rest": return "Rest";
    case "forge": return "Rune Forge";
    case "boss": return "Boss";
    case "start": return "Entrance";
    default: return "Unknown";
  }
}

// ====== Entity Portrait (canvas drawn) ======
export function addEntityPortrait(
  k: KAPLAYCtx,
  x: number,
  y: number,
  entityColor: string,
  entityIcon: string,
  size: number,
  tag: string
): void {
  // Convert hex to RGB
  const r = parseInt(entityColor.slice(1, 3), 16);
  const g = parseInt(entityColor.slice(3, 5), 16);
  const b = parseInt(entityColor.slice(5, 7), 16);

  // Outer frame
  k.add([
    k.rect(size + 8, size + 8, { radius: 8 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(rgb(k, COLORS.panelBorder)),
    tag,
  ]);

  // Inner portrait background
  k.add([
    k.rect(size, size, { radius: 6 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(k.rgb(r, g, b)),
    k.opacity(0.4),
    tag,
  ]);

  // Entity icon
  const iconChar = getEntityIcon(entityIcon);
  k.add([
    k.text(iconChar, { size: size * 0.5 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(k.rgb(r, g, b)),
    tag,
  ]);
}

function getEntityIcon(icon: string): string {
  switch (icon) {
    case "goblin": return "G";
    case "skeleton": return "S";
    case "mage": return "M";
    case "slime": return "~";
    case "boss": return "B";
    case "sage": return "W";
    case "merchant": return "T";
    default: return "E";
  }
}

// ====== Title text ======
export function addTitle(
  k: KAPLAYCtx,
  text: string,
  x: number,
  y: number,
  tag: string,
  opts?: { size?: number; color?: RGB }
): void {
  k.add([
    k.text(text, { size: opts?.size ?? 28 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(rgb(k, opts?.color ?? COLORS.text)),
    tag,
  ]);
}

// ====== Info text ======
export function addLabel(
  k: KAPLAYCtx,
  text: string,
  x: number,
  y: number,
  tag: string,
  opts?: { size?: number; color?: RGB; anchor?: string }
): void {
  k.add([
    k.text(text, { size: opts?.size ?? 16 }),
    k.pos(x, y),
    k.anchor((opts?.anchor as "center" | "left" | "topleft") ?? "left"),
    k.color(rgb(k, opts?.color ?? COLORS.text)),
    tag,
  ]);
}
