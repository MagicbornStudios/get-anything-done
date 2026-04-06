import type { KAPLAYCtx } from "kaplay";
import { getGameState, discoverRoom } from "../systems/gameState";

const INTRO_LINES = [
  "...",
  "A flash of light. Then darkness.",
  "You feel cold stone beneath your hands.",
  "The teleport stone behind you sparks once... then goes dark.",
  "Cracked. Useless.",
  "You are Kael, a dungeoneer. And you are stuck.",
  "Stuck at the bottom of a twelve-floor dungeon.",
  "No way back. Only up.",
  '"Guess I got to get out."',
  "",
  "[Press ENTER to begin your escape]",
];

export function loadIntroScene(k: KAPLAYCtx) {
  k.scene("intro", () => {
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(10, 10, 20)]);

    let lineIndex = 0;
    const textObjects: ReturnType<typeof k.add>[] = [];
    const startY = 180;

    function showNextLine() {
      if (lineIndex >= INTRO_LINES.length) return;

      const line = INTRO_LINES[lineIndex];
      const t = k.add([
        k.text(line, { size: line.startsWith("[") ? 18 : 22, width: 800 }),
        k.pos(k.width() / 2, startY + lineIndex * 36),
        k.anchor("center"),
        k.color(line.startsWith('"') ? 255 : 180, line.startsWith('"') ? 215 : 180, line.startsWith('"') ? 0 : 200),
        k.opacity(0),
      ]);

      textObjects.push(t);

      // Fade in
      let opacity = 0;
      const fadeTimer = k.onUpdate(() => {
        opacity += k.dt() * 2;
        if (opacity >= 1) {
          opacity = 1;
          fadeTimer.cancel();
        }
        t.opacity = opacity;
      });

      lineIndex++;
    }

    // Show lines with delay
    let timer = 0;
    let lineDelay = 0;
    const lineIntervals = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5];

    k.onUpdate(() => {
      timer += k.dt();
      if (lineDelay < lineIntervals.length && timer >= lineIntervals[lineDelay]) {
        showNextLine();
        lineDelay++;
      }
    });

    // Skip with enter or click
    const startGame = () => {
      const state = getGameState();
      discoverRoom(state.player.currentDepth, state.player.currentRoomId);
      k.go("game");
    };

    k.onKeyPress("enter", startGame);
    k.onKeyPress("space", startGame);
    k.onClick(startGame);
  });
}
