import type { KAPLAYCtx } from "kaplay";
import { makeButton, makeText, COLORS } from "../ui";
import { hasSave } from "../state";

const TAG = "title-ui";

export function titleScene(k: KAPLAYCtx) {
  // Scene definition -- this function runs when go("title") is called
  k.destroyAll(TAG);

  // Background gradient effect
  k.add([
    k.rect(800, 600),
    k.pos(400, 300),
    k.anchor("center"),
    k.color(20, 20, 35),
    TAG,
  ]);

  // Title text
  makeText(k, "ESCAPE THE DUNGEON", 400, 150, TAG, {
    size: 48,
    color: COLORS.accent,
  });

  // Subtitle
  makeText(k, "A Roguelike Dungeon Crawler", 400, 210, TAG, {
    size: 18,
    color: COLORS.textDim,
  });

  // New Game button -- THIS MUST WORK (previous run's critical failure)
  makeButton(k, "New Game", 400, 320, 200, 50, TAG, () => {
    k.go("newgame");
  });

  // Continue button (only if save exists)
  if (hasSave()) {
    makeButton(k, "Continue", 400, 390, 200, 50, TAG, () => {
      k.go("loadgame");
    });
  }

  // Credits
  makeText(k, "Navigate rooms. Fight monsters. Escape alive.", 400, 500, TAG, {
    size: 14,
    color: COLORS.textDim,
  });
}
