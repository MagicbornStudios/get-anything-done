import { makeButton, addCenteredText } from "../systems/ui";
import { hasSave, loadGame, startNewGame } from "../systems/state";

export function titleScene(k: any) {
  // Title
  addCenteredText(k, "Escape the Dungeon", k.height() * 0.25, 48, [255, 220, 100]);

  // Subtitle
  addCenteredText(k, "A Roguelike Dungeon Crawler", k.height() * 0.35, 20, [180, 180, 200]);

  // New Game button
  makeButton(k, {
    label: "New Game",
    x: k.width() / 2,
    y: k.height() * 0.55,
    width: 240,
    height: 52,
    fontSize: 24,
    onClick: () => {
      startNewGame("Hero");
      k.go("room");
    },
  });

  // Continue button (only if save exists)
  if (hasSave()) {
    makeButton(k, {
      label: "Continue",
      x: k.width() / 2,
      y: k.height() * 0.65,
      width: 240,
      height: 52,
      fontSize: 24,
      onClick: () => {
        loadGame();
        k.go("room");
      },
    });
  }

  // Version text
  addCenteredText(k, "v1.0 - Vite + TypeScript + KAPLAY", k.height() * 0.9, 14, [100, 100, 140]);
}
