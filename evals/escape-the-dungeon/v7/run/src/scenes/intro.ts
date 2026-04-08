import type { KAPLAYCtx } from "kaplay";

export function loadIntroScene(k: KAPLAYCtx) {
  k.scene("intro", () => {
    // Background
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(10, 10, 20)]);

    const storyLines = [
      "You are Kael, a dungeoneer who fell through a collapsed teleport stone.",
      "",
      "The stone is cracked and dark. There is no way back.",
      "",
      "Twelve floors of dungeon stretch above you, each guarded by a boss.",
      "Fight, negotiate, craft spells from ancient runes, and find your way out.",
      "",
      "The dungeon ticks forward with each step. The boss spawns more",
      "creatures every few ticks. Move fast, explore wisely.",
      "",
      "Your only way out is up.",
    ];

    // Story text
    let yPos = 120;
    for (const line of storyLines) {
      if (line === "") {
        yPos += 16;
        continue;
      }
      k.add([
        k.text(line, { size: 18, width: 800 }),
        k.pos(k.width() / 2, yPos),
        k.anchor("center"),
        k.color(190, 190, 210),
      ]);
      yPos += 32;
    }

    // Decorative line
    k.add([
      k.rect(300, 2),
      k.pos(k.width() / 2, yPos + 20),
      k.anchor("center"),
      k.color(100, 100, 140),
    ]);

    // Enter dungeon button
    const enterBtn = k.add([
      k.rect(280, 50, { radius: 8 }),
      k.pos(k.width() / 2, yPos + 70),
      k.anchor("center"),
      k.color(60, 40, 80),
      k.area(),
    ]);

    k.add([
      k.text("Enter the Dungeon", { size: 22 }),
      k.pos(k.width() / 2, yPos + 70),
      k.anchor("center"),
      k.color(220, 200, 255),
    ]);

    enterBtn.onClick(() => {
      k.go("game");
    });

    enterBtn.onHover(() => {
      enterBtn.color = k.rgb(90, 60, 120);
    });

    enterBtn.onHoverEnd(() => {
      enterBtn.color = k.rgb(60, 40, 80);
    });

    // Keyboard shortcut
    k.onKeyPress("enter", () => {
      k.go("game");
    });

    k.onKeyPress("space", () => {
      k.go("game");
    });
  });
}
