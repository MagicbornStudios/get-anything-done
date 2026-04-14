import type { KAPLAYCtx } from "kaplay";
import { getGameState, resetGameState, deleteSave } from "../systems/gameState";

export function loadGameOverScene(k: KAPLAYCtx) {
  k.scene("gameOver", () => {
    const state = getGameState();
    const player = state.player;

    // Check if player won (got past all floors)
    const won = player.combatStats.currentHp > 0;

    // Background
    const bgColor = won ? [12, 25, 18] : [30, 10, 10];
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(bgColor[0], bgColor[1], bgColor[2])]);

    // Title
    const title = won ? "ESCAPE SUCCESSFUL!" : "GAME OVER";
    const titleColor = won ? [100, 255, 150] : [255, 60, 60];
    k.add([
      k.text(title, { size: 52 }),
      k.pos(k.width() / 2, 120),
      k.anchor("center"),
      k.color(titleColor[0], titleColor[1], titleColor[2]),
    ]);

    // Subtitle
    const subtitle = won
      ? "You escaped the dungeon!"
      : "You have been defeated...";
    k.add([
      k.text(subtitle, { size: 22 }),
      k.pos(k.width() / 2, 185),
      k.anchor("center"),
      k.color(180, 180, 200),
    ]);

    // Decorative line
    k.add([
      k.rect(300, 2),
      k.pos(k.width() / 2, 220),
      k.anchor("center"),
      k.color(80, 80, 110),
    ]);

    // Stats summary
    const statsY = 260;
    const stats = [
      `Level: ${player.level}`,
      `XP Earned: ${player.xp}`,
      `Floor Reached: ${player.currentDepth}`,
      `Dungeon Ticks: ${player.dungeonTick}`,
      `Crystals: ${player.manaCrystals}`,
      `Spells Learned: ${player.spellPool.length}`,
      `Fame: ${player.fame}`,
    ];

    k.add([
      k.text("Run Summary", { size: 18 }),
      k.pos(k.width() / 2, statsY),
      k.anchor("center"),
      k.color(200, 200, 220),
    ]);

    stats.forEach((stat, i) => {
      k.add([
        k.text(stat, { size: 16 }),
        k.pos(k.width() / 2, statsY + 30 + i * 26),
        k.anchor("center"),
        k.color(170, 170, 190),
      ]);
    });

    // New Game button
    const newGameBtn = k.add([
      k.rect(250, 48, { radius: 8 }),
      k.pos(k.width() / 2, 560),
      k.anchor("center"),
      k.color(40, 80, 60),
      k.area(),
    ]);

    k.add([
      k.text("New Game", { size: 20 }),
      k.pos(k.width() / 2, 560),
      k.anchor("center"),
      k.color(200, 255, 200),
    ]);

    newGameBtn.onClick(() => {
      deleteSave();
      resetGameState();
      k.go("intro");
    });

    newGameBtn.onHover(() => { newGameBtn.color = k.rgb(60, 120, 80); });
    newGameBtn.onHoverEnd(() => { newGameBtn.color = k.rgb(40, 80, 60); });

    // Main Menu button
    const menuBtn = k.add([
      k.rect(250, 48, { radius: 8 }),
      k.pos(k.width() / 2, 625),
      k.anchor("center"),
      k.color(50, 50, 70),
      k.area(),
    ]);

    k.add([
      k.text("Main Menu", { size: 20 }),
      k.pos(k.width() / 2, 625),
      k.anchor("center"),
      k.color(200, 200, 220),
    ]);

    menuBtn.onClick(() => {
      deleteSave();
      resetGameState();
      k.go("mainMenu");
    });

    menuBtn.onHover(() => { menuBtn.color = k.rgb(70, 70, 95); });
    menuBtn.onHoverEnd(() => { menuBtn.color = k.rgb(50, 50, 70); });

    // Keyboard shortcut
    k.onKeyPress("enter", () => {
      deleteSave();
      resetGameState();
      k.go("intro");
    });
  });
}
