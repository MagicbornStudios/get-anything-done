import type { KAPLAYCtx } from "kaplay";
import { getGameState } from "../systems/gameState";

export function loadDialogueScene(k: KAPLAYCtx) {
  k.scene("dialogue", () => {
    const state = getGameState();
    const npc = state.currentDialogueNpc;

    if (!npc) {
      k.go("game");
      return;
    }

    const lines = npc.dialogueLines || ["..."];
    let lineIndex = 0;

    // Background
    k.add([k.rect(k.width(), k.height()), k.pos(0, 0), k.color(15, 18, 28)]);

    // Header
    k.add([k.rect(k.width(), 50), k.pos(0, 0), k.color(20, 25, 40)]);
    k.add([
      k.text("DIALOGUE", { size: 18 }),
      k.pos(k.width() / 2, 25),
      k.anchor("center"),
      k.color(160, 160, 200),
    ]);

    // NPC portrait placeholder
    const portraitSize = 140;
    k.add([
      k.rect(portraitSize, portraitSize, { radius: 12 }),
      k.pos(k.width() / 2, 150),
      k.anchor("center"),
      k.color(40, 60, 80),
    ]);

    // NPC initials as portrait
    const initials = npc.name.split(" ").map((w) => w[0]).join("").substring(0, 2);
    k.add([
      k.text(initials, { size: 48 }),
      k.pos(k.width() / 2, 150),
      k.anchor("center"),
      k.color(180, 200, 240),
    ]);

    // NPC name
    k.add([
      k.text(npc.name, { size: 24 }),
      k.pos(k.width() / 2, 240),
      k.anchor("center"),
      k.color(255, 215, 0),
    ]);

    // NPC info
    const roleText = npc.partyRoleId ? ` (${npc.partyRoleId})` : "";
    k.add([
      k.text(`${npc.occupationId}${roleText} - Lv.${npc.level}`, { size: 14 }),
      k.pos(k.width() / 2, 270),
      k.anchor("center"),
      k.color(140, 140, 170),
    ]);

    // Dialogue box
    k.add([
      k.rect(700, 140, { radius: 8 }),
      k.pos(k.width() / 2, 370),
      k.anchor("center"),
      k.color(20, 22, 35),
    ]);

    // Dialogue border
    k.add([
      k.rect(704, 144, { radius: 10 }),
      k.pos(k.width() / 2, 370),
      k.anchor("center"),
      k.color(60, 60, 90),
      k.outline(2),
      k.z(-1),
    ]);

    // Dialogue text (mutable)
    const dialogueText = k.add([
      k.text(lines[lineIndex], { size: 16, width: 660 }),
      k.pos(k.width() / 2 - 330, 320),
      k.color(200, 200, 220),
    ]);

    // Line counter
    const lineCounter = k.add([
      k.text(`${lineIndex + 1}/${lines.length}`, { size: 12 }),
      k.pos(k.width() / 2 + 320, 430),
      k.anchor("right"),
      k.color(100, 100, 130),
    ]);

    // Continue button
    const continueBtn = k.add([
      k.rect(200, 42, { radius: 6 }),
      k.pos(k.width() / 2, 490),
      k.anchor("center"),
      k.color(40, 60, 80),
      k.area(),
    ]);

    const continueBtnLabel = k.add([
      k.text("Continue", { size: 16 }),
      k.pos(k.width() / 2, 490),
      k.anchor("center"),
      k.color(200, 220, 255),
    ]);

    function advance() {
      lineIndex++;
      if (lineIndex >= lines.length) {
        // End dialogue
        state.currentDialogueNpc = null;
        k.go("game");
        return;
      }
      dialogueText.text = lines[lineIndex];
      lineCounter.text = `${lineIndex + 1}/${lines.length}`;

      if (lineIndex === lines.length - 1) {
        continueBtnLabel.text = "Leave";
      }
    }

    continueBtn.onClick(advance);
    continueBtn.onHover(() => { continueBtn.color = k.rgb(60, 80, 110); });
    continueBtn.onHoverEnd(() => { continueBtn.color = k.rgb(40, 60, 80); });

    // Leave early button
    const leaveBtn = k.add([
      k.rect(120, 36, { radius: 6 }),
      k.pos(k.width() / 2, 550),
      k.anchor("center"),
      k.color(60, 40, 40),
      k.area(),
    ]);

    k.add([
      k.text("Leave", { size: 14 }),
      k.pos(k.width() / 2, 550),
      k.anchor("center"),
      k.color(200, 160, 160),
    ]);

    leaveBtn.onClick(() => {
      state.currentDialogueNpc = null;
      k.go("game");
    });

    leaveBtn.onHover(() => { leaveBtn.color = k.rgb(80, 50, 50); });
    leaveBtn.onHoverEnd(() => { leaveBtn.color = k.rgb(60, 40, 40); });

    // Keyboard shortcuts
    k.onKeyPress("enter", advance);
    k.onKeyPress("space", advance);
    k.onKeyPress("escape", () => {
      state.currentDialogueNpc = null;
      k.go("game");
    });
  });
}
