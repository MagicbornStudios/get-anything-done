// Title screen scene
import type { KAPLAYCtx } from "kaplay";
import { hasSave, loadGame, newGame } from "../systems/gamestate";

export function titleScene(k: KAPLAYCtx) {
  const W = k.width();
  const H = k.height();

  // Background gradient effect
  k.add([
    k.rect(W, H),
    k.pos(0, 0),
    k.color(10, 10, 26),
  ]);

  // Animated particles (floating runes)
  for (let i = 0; i < 20; i++) {
    const px = Math.random() * W;
    const py = Math.random() * H;
    const speed = 10 + Math.random() * 20;
    const size = 8 + Math.random() * 16;
    const particle = k.add([
      k.text(["*", "+", "."][Math.floor(Math.random() * 3)], { size }),
      k.pos(px, py),
      k.color(60 + Math.random() * 40, 80 + Math.random() * 40, 140 + Math.random() * 60),
      k.opacity(0.2 + Math.random() * 0.3),
      k.anchor("center"),
    ]);
    particle.onUpdate(() => {
      particle.pos.y -= speed * k.dt();
      if (particle.pos.y < -20) {
        particle.pos.y = H + 20;
        particle.pos.x = Math.random() * W;
      }
    });
  }

  // Title text
  k.add([
    k.text("ESCAPE", { size: 72, font: "monospace" }),
    k.pos(W / 2, H * 0.22),
    k.anchor("center"),
    k.color(100, 180, 255),
  ]);

  k.add([
    k.text("THE DUNGEON", { size: 48, font: "monospace" }),
    k.pos(W / 2, H * 0.33),
    k.anchor("center"),
    k.color(180, 140, 255),
  ]);

  // Decorative line
  k.add([
    k.rect(300, 2),
    k.pos(W / 2, H * 0.40),
    k.anchor("center"),
    k.color(80, 100, 160),
  ]);

  // Subtitle
  k.add([
    k.text("A Roguelike Dungeon Crawler", { size: 18, font: "monospace" }),
    k.pos(W / 2, H * 0.45),
    k.anchor("center"),
    k.color(140, 145, 170),
  ]);

  // New Game button
  const newGameBtn = makeButton(k, W / 2, H * 0.58, 240, 48, "New Game", () => {
    newGame();
    k.go("room");
  });

  // Continue button (only if save exists)
  if (hasSave()) {
    makeButton(k, W / 2, H * 0.68, 240, 48, "Continue", () => {
      loadGame();
      k.go("room");
    });
  }

  // Version text
  k.add([
    k.text("v8 - KAPLAY Edition", { size: 12, font: "monospace" }),
    k.pos(W / 2, H * 0.92),
    k.anchor("center"),
    k.color(80, 85, 110),
  ]);

  // Animated glow on title
  const titleGlow = k.add([
    k.rect(400, 100),
    k.pos(W / 2, H * 0.27),
    k.anchor("center"),
    k.color(100, 180, 255),
    k.opacity(0.03),
  ]);
  let glowDir = 1;
  titleGlow.onUpdate(() => {
    titleGlow.opacity += 0.015 * k.dt() * glowDir;
    if (titleGlow.opacity > 0.06) glowDir = -1;
    if (titleGlow.opacity < 0.01) glowDir = 1;
  });
}

function makeButton(
  k: KAPLAYCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  action: () => void,
) {
  // Button background
  const bg = k.add([
    k.rect(w, h, { radius: 8 }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(30, 40, 70),
    k.outline(2, k.Color.fromArray([80, 100, 160])),
    k.area(),
    "btn",
  ]);

  // Button text
  const txt = k.add([
    k.text(label, { size: 22, font: "monospace" }),
    k.pos(x, y),
    k.anchor("center"),
    k.color(200, 210, 240),
  ]);

  // Hover effects
  bg.onHoverUpdate(() => {
    bg.color = k.Color.fromArray([50, 65, 100]);
    txt.color = k.Color.fromArray([255, 255, 255]);
    k.setCursor("pointer");
  });
  bg.onHoverEnd(() => {
    bg.color = k.Color.fromArray([30, 40, 70]);
    txt.color = k.Color.fromArray([200, 210, 240]);
    k.setCursor("default");
  });
  bg.onClick(action);

  return bg;
}
