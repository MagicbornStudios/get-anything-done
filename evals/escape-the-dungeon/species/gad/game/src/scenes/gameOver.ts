import type { KAPLAYCtx } from "kaplay";
import { getGameState, resetGameState } from "../systems/gameState";

export function loadGameOverScene(k: KAPLAYCtx) {
  k.scene("gameOver", () => {
    const state = getGameState();

    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(15, 5, 5)]);

    k.add([
      k.text("GAME OVER", { size: 56 }),
      k.pos(k.width() / 2, 200),
      k.anchor("center"),
      k.color(200, 40, 40),
    ]);

    k.add([
      k.text("The dungeon claims another soul...", { size: 20 }),
      k.pos(k.width() / 2, 270),
      k.anchor("center"),
      k.color(160, 120, 120),
    ]);

    // Stats summary
    const stats = [
      `Level: ${state.player.level}`,
      `Floor reached: ${state.player.currentDepth}`,
      `Dungeon ticks: ${state.player.dungeonTick}`,
      `Spells known: ${state.player.spellPool.length}`,
    ];

    stats.forEach((line, i) => {
      k.add([
        k.text(line, { size: 16 }),
        k.pos(k.width() / 2, 330 + i * 28),
        k.anchor("center"),
        k.color(140, 140, 160),
      ]);
    });

    // Retry button
    const retryBtn = k.add([
      k.rect(200, 50, { radius: 8 }),
      k.pos(k.width() / 2, 500),
      k.anchor("center"),
      k.color(80, 40, 40),
      k.area(),
    ]);

    k.add([
      k.text("Try Again", { size: 22 }),
      k.pos(k.width() / 2, 500),
      k.anchor("center"),
      k.color(255, 200, 200),
    ]);

    retryBtn.onClick(() => {
      resetGameState();
      k.go("intro");
    });

    // Main menu
    const menuBtn = k.add([
      k.rect(200, 50, { radius: 8 }),
      k.pos(k.width() / 2, 570),
      k.anchor("center"),
      k.color(40, 40, 60),
      k.area(),
    ]);

    k.add([
      k.text("Main Menu", { size: 22 }),
      k.pos(k.width() / 2, 570),
      k.anchor("center"),
      k.color(200, 200, 220),
    ]);

    menuBtn.onClick(() => {
      k.go("mainMenu");
    });

    k.onKeyPress("enter", () => {
      resetGameState();
      k.go("intro");
    });
  });
}
