import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { deleteSave } from "../systems/gamestate";

export function setupGameOverScene(k: KAPLAYCtx) {
  k.scene("gameover", (_params: { state: GameState }) => {
    k.add([k.rect(800, 600), k.pos(0, 0), k.color(20, 5, 5)]);

    k.add([
      k.text("GAME OVER", { size: 48 }),
      k.pos(400, 200),
      k.anchor("center"),
      k.color(200, 50, 50),
    ]);

    k.add([
      k.text("The dungeon claims another soul...", { size: 18 }),
      k.pos(400, 270),
      k.anchor("center"),
      k.color(180, 120, 120),
    ]);

    const retryBtn = k.add([
      k.rect(200, 50, { radius: 8 }),
      k.pos(400, 380),
      k.anchor("center"),
      k.color(120, 50, 50),
      k.area(),
    ]);
    k.add([
      k.text("Try Again", { size: 20 }),
      k.pos(400, 380),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);
    retryBtn.onClick(() => {
      deleteSave();
      k.go("title");
    });

    const menuBtn = k.add([
      k.rect(200, 50, { radius: 8 }),
      k.pos(400, 450),
      k.anchor("center"),
      k.color(60, 60, 80),
      k.area(),
    ]);
    k.add([
      k.text("Main Menu", { size: 20 }),
      k.pos(400, 450),
      k.anchor("center"),
      k.color(200, 200, 220),
    ]);
    menuBtn.onClick(() => {
      deleteSave();
      k.go("title");
    });
  });
}
