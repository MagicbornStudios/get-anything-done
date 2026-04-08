import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { deleteSave } from "../systems/gamestate";

export function setupVictoryScene(k: KAPLAYCtx) {
  k.scene("victory", (params: { state: GameState }) => {
    const { state } = params;

    k.add([k.rect(800, 600), k.pos(0, 0), k.color(10, 20, 30)]);

    k.add([
      k.text("VICTORY!", { size: 52 }),
      k.pos(400, 150),
      k.anchor("center"),
      k.color(255, 215, 0),
    ]);

    k.add([
      k.text("You have escaped the dungeon!", { size: 22 }),
      k.pos(400, 220),
      k.anchor("center"),
      k.color(200, 220, 255),
    ]);

    // Stats summary
    const lines = [
      `Level: ${state.player.level}`,
      `Crystals collected: ${state.player.crystals}`,
      `Rooms cleared: ${state.clearedRooms.length}`,
      `Bosses defeated: ${state.defeatedBosses.length}`,
      `Dungeon ticks: ${state.dungeonTick}`,
    ];
    lines.forEach((line, i) => {
      k.add([
        k.text(line, { size: 16 }),
        k.pos(400, 290 + i * 28),
        k.anchor("center"),
        k.color(180, 200, 220),
      ]);
    });

    const menuBtn = k.add([
      k.rect(200, 50, { radius: 8 }),
      k.pos(400, 500),
      k.anchor("center"),
      k.color(60, 120, 60),
      k.area(),
    ]);
    k.add([
      k.text("Main Menu", { size: 20 }),
      k.pos(400, 500),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);
    menuBtn.onClick(() => {
      deleteSave();
      k.go("title");
    });
  });
}
