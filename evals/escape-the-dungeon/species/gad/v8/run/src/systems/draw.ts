// Drawing utilities for UI elements, sprites, and visual effects
import type { RoomType } from "../types";

// Color palette
export const COLORS = {
  bg: [10, 10, 26] as const,
  panel: [20, 22, 40] as const,
  panelBorder: [60, 65, 100] as const,
  panelLight: [30, 35, 55] as const,
  text: [220, 220, 240] as const,
  textDim: [140, 145, 170] as const,
  accent: [100, 180, 255] as const,
  hp: [220, 50, 50] as const,
  hpBg: [80, 20, 20] as const,
  mana: [50, 100, 220] as const,
  manaBg: [20, 30, 80] as const,
  xp: [255, 200, 50] as const,
  gold: [255, 215, 0] as const,
  success: [80, 200, 80] as const,
  danger: [220, 60, 60] as const,
  warning: [220, 180, 50] as const,
};

export const ROOM_THEMES: Record<RoomType, { bg: string; accent: string; icon: string; label: string }> = {
  combat: { bg: "#1a0a0a", accent: "#cc3333", icon: "\u{2694}\u{FE0F}", label: "Combat" },
  dialogue: { bg: "#0a1a0a", accent: "#33aa55", icon: "\u{1F4AC}", label: "Dialogue" },
  treasure: { bg: "#1a1a0a", accent: "#ccaa33", icon: "\u{1F4E6}", label: "Treasure" },
  rest: { bg: "#0a0a1a", accent: "#3366cc", icon: "\u{1F6CF}\u{FE0F}", label: "Rest" },
  forge: { bg: "#1a0a1a", accent: "#aa33cc", icon: "\u{2728}", label: "Forge" },
  boss: { bg: "#1a0505", accent: "#ff4444", icon: "\u{1F480}", label: "Boss" },
};

export const DIRECTION_LABELS: Record<string, string> = {
  north: "\u{2B06}\u{FE0F} North",
  south: "\u{2B07}\u{FE0F} South",
  east: "\u{27A1}\u{FE0F} East",
  west: "\u{2B05}\u{FE0F} West",
};

// Canvas-drawn entity sprites
export function drawSlimeSprite(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);

  // Body - blobby shape
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.1, size * 0.4, size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Darker bottom
  ctx.fillStyle = adjustColor(color, -40);
  ctx.beginPath();
  ctx.ellipse(0, size * 0.2, size * 0.42, size * 0.15, 0, 0, Math.PI);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-size * 0.12, -size * 0.02, size * 0.08, 0, Math.PI * 2);
  ctx.arc(size * 0.12, -size * 0.02, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#222222";
  ctx.beginPath();
  ctx.arc(-size * 0.1, 0, size * 0.04, 0, Math.PI * 2);
  ctx.arc(size * 0.14, 0, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(-size * 0.15, -size * 0.15, size * 0.08, size * 0.06, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawSkeletonSprite(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);

  // Skull
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -size * 0.2, size * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Jaw
  ctx.fillStyle = adjustColor(color, -20);
  ctx.fillRect(-size * 0.12, -size * 0.08, size * 0.24, size * 0.08);

  // Eye sockets
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(-size * 0.07, -size * 0.22, size * 0.05, 0, Math.PI * 2);
  ctx.arc(size * 0.07, -size * 0.22, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Eye glow
  ctx.fillStyle = "#ff4444";
  ctx.beginPath();
  ctx.arc(-size * 0.07, -size * 0.22, size * 0.025, 0, Math.PI * 2);
  ctx.arc(size * 0.07, -size * 0.22, size * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // Ribcage
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const ry = size * 0.05 + i * size * 0.08;
    ctx.beginPath();
    ctx.ellipse(0, ry, size * 0.15 - i * size * 0.02, size * 0.02, 0, 0, Math.PI);
    ctx.stroke();
  }

  // Spine
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.05);
  ctx.lineTo(0, size * 0.35);
  ctx.stroke();

  // Sword
  ctx.strokeStyle = "#aaaacc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size * 0.25, -size * 0.3);
  ctx.lineTo(size * 0.25, size * 0.15);
  ctx.stroke();
  // Crossguard
  ctx.beginPath();
  ctx.moveTo(size * 0.15, -size * 0.08);
  ctx.lineTo(size * 0.35, -size * 0.08);
  ctx.stroke();

  ctx.restore();
}

export function drawMageSprite(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);

  // Hat
  ctx.fillStyle = adjustColor(color, -30);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.45);
  ctx.lineTo(-size * 0.2, -size * 0.1);
  ctx.lineTo(size * 0.2, -size * 0.1);
  ctx.closePath();
  ctx.fill();

  // Hat brim
  ctx.fillStyle = adjustColor(color, -40);
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.1, size * 0.28, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.fillStyle = "#ddccbb";
  ctx.beginPath();
  ctx.arc(0, -size * 0.02, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (glowing)
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(-size * 0.05, -size * 0.04, size * 0.03, 0, Math.PI * 2);
  ctx.arc(size * 0.05, -size * 0.04, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Robe
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.15, size * 0.08);
  ctx.lineTo(-size * 0.25, size * 0.4);
  ctx.lineTo(size * 0.25, size * 0.4);
  ctx.lineTo(size * 0.15, size * 0.08);
  ctx.closePath();
  ctx.fill();

  // Staff with orb
  ctx.strokeStyle = "#886633";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-size * 0.3, -size * 0.35);
  ctx.lineTo(-size * 0.3, size * 0.35);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(-size * 0.3, -size * 0.35, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

export function drawGolemSprite(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);

  // Body (large rectangle)
  ctx.fillStyle = color;
  ctx.fillRect(-size * 0.3, -size * 0.2, size * 0.6, size * 0.55);

  // Head
  ctx.fillStyle = adjustColor(color, 10);
  ctx.fillRect(-size * 0.18, -size * 0.4, size * 0.36, size * 0.22);

  // Eyes (glowing cracks)
  ctx.fillStyle = "#ff6600";
  ctx.shadowColor = "#ff6600";
  ctx.shadowBlur = 10;
  ctx.fillRect(-size * 0.12, -size * 0.32, size * 0.08, size * 0.04);
  ctx.fillRect(size * 0.04, -size * 0.32, size * 0.08, size * 0.04);
  ctx.shadowBlur = 0;

  // Cracks
  ctx.strokeStyle = "#ff6600";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, -size * 0.1);
  ctx.lineTo(-size * 0.2, size * 0.1);
  ctx.lineTo(-size * 0.05, size * 0.2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.1, 0);
  ctx.lineTo(size * 0.2, size * 0.15);
  ctx.stroke();

  // Arms
  ctx.fillStyle = adjustColor(color, -15);
  ctx.fillRect(-size * 0.45, -size * 0.15, size * 0.16, size * 0.4);
  ctx.fillRect(size * 0.29, -size * 0.15, size * 0.16, size * 0.4);

  // Fists
  ctx.fillStyle = adjustColor(color, -25);
  ctx.fillRect(-size * 0.47, size * 0.2, size * 0.2, size * 0.12);
  ctx.fillRect(size * 0.27, size * 0.2, size * 0.2, size * 0.12);

  ctx.restore();
}

export function drawNPCPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);

  // Hood/cloak
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -size * 0.05, size * 0.3, Math.PI, 0);
  ctx.lineTo(size * 0.3, size * 0.35);
  ctx.lineTo(-size * 0.3, size * 0.35);
  ctx.closePath();
  ctx.fill();

  // Face
  ctx.fillStyle = "#eeddcc";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.arc(-size * 0.06, -size * 0.02, size * 0.03, 0, Math.PI * 2);
  ctx.arc(size * 0.06, -size * 0.02, size * 0.03, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, size * 0.05, size * 0.08, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Beard (for sage)
  ctx.fillStyle = "#cccccc";
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, size * 0.1);
  ctx.quadraticCurveTo(0, size * 0.3, size * 0.1, size * 0.1);
  ctx.fill();

  ctx.restore();
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function getEnemyDrawFn(enemyId: string): (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => void {
  switch (enemyId) {
    case "slime": return drawSlimeSprite;
    case "skeleton": return drawSkeletonSprite;
    case "dark_mage": return drawMageSprite;
    case "boss_golem": return drawGolemSprite;
    default: return drawSlimeSprite;
  }
}
