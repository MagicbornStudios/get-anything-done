import type { KAPLAYCtx } from "kaplay";
import { loadIconSprite, GAME_ICONS } from "../systems/icons";
import { hasSave, loadGame } from "../systems/gameState";
import { newGame } from "../systems/gameState";

export function titleScene(k: KAPLAYCtx) {
  // Load icons for the title screen
  loadIconSprite(k, "icon-sword", GAME_ICONS.sword, "#ffd700", 96);
  loadIconSprite(k, "icon-shield", GAME_ICONS.shield, "#c0c0c0", 96);

  // Dark gradient background
  k.add([
    k.rect(k.width(), k.height()),
    k.color(15, 15, 35),
    k.pos(0, 0),
  ]);

  // Decorative top bar
  k.add([
    k.rect(k.width(), 4),
    k.color(255, 215, 0),
    k.pos(0, 0),
  ]);

  // Decorative bottom bar
  k.add([
    k.rect(k.width(), 4),
    k.color(255, 215, 0),
    k.pos(0, k.height() - 4),
  ]);

  // Side decorations
  k.add([
    k.rect(4, k.height()),
    k.color(100, 80, 40),
    k.pos(0, 0),
  ]);
  k.add([
    k.rect(4, k.height()),
    k.color(100, 80, 40),
    k.pos(k.width() - 4, 0),
  ]);

  // Title text with shadow
  k.add([
    k.text("ESCAPE", { size: 64 }),
    k.pos(k.width() / 2 + 3, k.height() / 5 + 3),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.opacity(0.5),
  ]);
  k.add([
    k.text("ESCAPE", { size: 64 }),
    k.pos(k.width() / 2, k.height() / 5),
    k.anchor("center"),
    k.color(255, 215, 0),
  ]);

  k.add([
    k.text("THE DUNGEON", { size: 40 }),
    k.pos(k.width() / 2 + 2, k.height() / 5 + 62),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.opacity(0.5),
  ]);
  k.add([
    k.text("THE DUNGEON", { size: 40 }),
    k.pos(k.width() / 2, k.height() / 5 + 60),
    k.anchor("center"),
    k.color(200, 180, 140),
  ]);

  // Subtitle
  k.add([
    k.text("A Roguelike Dungeon Crawler", { size: 18 }),
    k.pos(k.width() / 2, k.height() / 5 + 110),
    k.anchor("center"),
    k.color(120, 120, 160),
  ]);

  // Divider line
  k.add([
    k.rect(300, 2),
    k.color(80, 70, 50),
    k.pos(k.width() / 2, k.height() / 2 - 20),
    k.anchor("center"),
  ]);

  // Menu options
  const menuY = k.height() / 2 + 20;

  const newGameBtn = k.add([
    k.rect(260, 48, { radius: 6 }),
    k.color(40, 80, 40),
    k.outline(2, k.Color.fromHex("#4a4")),
    k.pos(k.width() / 2, menuY),
    k.anchor("center"),
    k.area(),
  ]);
  k.add([
    k.text("New Game", { size: 22 }),
    k.pos(k.width() / 2, menuY),
    k.anchor("center"),
    k.color(150, 255, 150),
  ]);

  const hasExistingSave = hasSave();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let continueBtn: any = null;
  if (hasExistingSave) {
    continueBtn = k.add([
      k.rect(260, 48, { radius: 6 }),
      k.color(40, 40, 80),
      k.outline(2, k.Color.fromHex("#66f")),
      k.pos(k.width() / 2, menuY + 64),
      k.anchor("center"),
      k.area(),
    ]);
    k.add([
      k.text("Continue", { size: 22 }),
      k.pos(k.width() / 2, menuY + 64),
      k.anchor("center"),
      k.color(150, 150, 255),
    ]);
  }

  // Footer text
  k.add([
    k.text("Craft spells. Adapt. Survive.", { size: 14 }),
    k.pos(k.width() / 2, k.height() - 50),
    k.anchor("center"),
    k.color(80, 80, 100),
  ]);

  // Pulsing prompt
  const prompt = k.add([
    k.text("Click a button or press ENTER", { size: 14 }),
    k.pos(k.width() / 2, k.height() - 30),
    k.anchor("center"),
    k.color(100, 100, 130),
    k.opacity(0.7),
  ]);

  let pulseTime = 0;
  prompt.onUpdate(() => {
    pulseTime += k.dt() * 2;
    prompt.opacity = 0.4 + Math.sin(pulseTime) * 0.3;
  });

  // Hover effects
  newGameBtn.onHover(() => {
    newGameBtn.color = k.Color.fromHex("#3a6a3a");
  });
  newGameBtn.onHoverEnd(() => {
    newGameBtn.color = k.Color.fromHex("#285028");
  });

  // Click handlers
  newGameBtn.onClick(() => {
    newGame();
    k.go("room");
  });

  if (continueBtn) {
    const btn = continueBtn;
    btn.onHover(() => {
      btn.color = k.Color.fromHex("#3a3a6a");
    });
    btn.onHoverEnd(() => {
      btn.color = k.Color.fromHex("#282850");
    });
    btn.onClick(() => {
      const saved = loadGame();
      if (saved) {
        k.go("room");
      }
    });
  }

  // Keyboard
  k.onKeyPress("enter", () => {
    newGame();
    k.go("room");
  });
}
