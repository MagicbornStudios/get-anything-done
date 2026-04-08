import type { KAPLAYCtx } from "kaplay";
import { hasSave, loadGame, deleteSave } from "../systems/gamestate";

export function setupTitleScene(k: KAPLAYCtx) {
  k.scene("title", () => {
    // Background
    k.add([
      k.rect(800, 600),
      k.pos(0, 0),
      k.color(15, 15, 25),
    ]);

    // Title text
    k.add([
      k.text("ESCAPE THE DUNGEON", { size: 42 }),
      k.pos(400, 120),
      k.anchor("center"),
      k.color(255, 215, 0),
    ]);

    // Subtitle
    k.add([
      k.text("A Roguelike Dungeon Crawler", { size: 18 }),
      k.pos(400, 170),
      k.anchor("center"),
      k.color(180, 180, 200),
    ]);

    // Decorative line
    k.add([
      k.rect(400, 2),
      k.pos(400, 200),
      k.anchor("center"),
      k.color(100, 100, 140),
    ]);

    const btnY = 300;
    const btnW = 250;
    const btnH = 50;

    // New Game button
    const newGameBtn = k.add([
      k.rect(btnW, btnH, { radius: 8 }),
      k.pos(400, btnY),
      k.anchor("center"),
      k.color(60, 120, 60),
      k.area(),
      "btn",
    ]);
    k.add([
      k.text("New Game", { size: 22 }),
      k.pos(400, btnY),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);

    newGameBtn.onClick(() => {
      if (hasSave()) deleteSave();
      k.go("game", { newGame: true });
    });

    // Continue button (if save exists)
    if (hasSave()) {
      const contBtn = k.add([
        k.rect(btnW, btnH, { radius: 8 }),
        k.pos(400, btnY + 70),
        k.anchor("center"),
        k.color(60, 60, 120),
        k.area(),
        "btn",
      ]);
      k.add([
        k.text("Continue", { size: 22 }),
        k.pos(400, btnY + 70),
        k.anchor("center"),
        k.color(255, 255, 255),
      ]);

      contBtn.onClick(() => {
        const state = loadGame();
        if (state) {
          k.go("game", { newGame: false, savedState: state });
        }
      });
    }

    // Footer
    k.add([
      k.text("Navigate the dungeon. Fight or negotiate. Escape.", { size: 14 }),
      k.pos(400, 530),
      k.anchor("center"),
      k.color(120, 120, 140),
    ]);

    // Hover effects
    k.onHover("btn", (btn) => {
      btn.color = k.rgb(100, 180, 100);
      k.setCursor("pointer");
    });
    k.onHoverEnd("btn", (btn) => {
      // Reset color based on tag
      btn.color = k.rgb(60, 120, 60);
      k.setCursor("default");
    });
  });
}
