import type { KAPLAYCtx } from "kaplay";
import { resetGameState, loadGame, hasSave } from "../systems/gameState";

export function loadMainMenuScene(k: KAPLAYCtx) {
  k.scene("mainMenu", () => {
    // Background
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(26, 26, 46)]);

    // Title
    k.add([
      k.text("ESCAPE THE DUNGEON", { size: 56 }),
      k.pos(k.width() / 2, 160),
      k.anchor("center"),
      k.color(255, 215, 0),
    ]);

    // Subtitle
    k.add([
      k.text("A roguelike dungeon crawler", { size: 20 }),
      k.pos(k.width() / 2, 220),
      k.anchor("center"),
      k.color(180, 180, 200),
    ]);

    // Decorative line
    k.add([
      k.rect(400, 2),
      k.pos(k.width() / 2, 255),
      k.anchor("center"),
      k.color(100, 100, 140),
    ]);

    // New Game button
    const newGameBtn = k.add([
      k.rect(280, 50, { radius: 8 }),
      k.pos(k.width() / 2, 340),
      k.anchor("center"),
      k.color(40, 80, 60),
      k.area(),
    ]);

    k.add([
      k.text("New Game", { size: 24 }),
      k.pos(k.width() / 2, 340),
      k.anchor("center"),
      k.color(200, 255, 200),
    ]);

    newGameBtn.onClick(() => {
      resetGameState();
      k.go("intro");
    });

    newGameBtn.onHover(() => {
      newGameBtn.color = k.rgb(60, 120, 80);
    });

    newGameBtn.onHoverEnd(() => {
      newGameBtn.color = k.rgb(40, 80, 60);
    });

    // Continue button (if save exists)
    if (hasSave()) {
      const continueBtn = k.add([
        k.rect(280, 50, { radius: 8 }),
        k.pos(k.width() / 2, 410),
        k.anchor("center"),
        k.color(40, 60, 80),
        k.area(),
      ]);

      k.add([
        k.text("Continue", { size: 24 }),
        k.pos(k.width() / 2, 410),
        k.anchor("center"),
        k.color(200, 220, 255),
      ]);

      continueBtn.onClick(() => {
        if (loadGame()) {
          k.go("game");
        }
      });

      continueBtn.onHover(() => {
        continueBtn.color = k.rgb(60, 80, 120);
      });

      continueBtn.onHoverEnd(() => {
        continueBtn.color = k.rgb(40, 60, 80);
      });
    }

    // Credits
    k.add([
      k.text("Built with KAPLAY + TypeScript", { size: 14 }),
      k.pos(k.width() / 2, k.height() - 40),
      k.anchor("center"),
      k.color(100, 100, 120),
    ]);

    // Keyboard: Enter starts new game
    k.onKeyPress("enter", () => {
      resetGameState();
      k.go("intro");
    });
  });
}
