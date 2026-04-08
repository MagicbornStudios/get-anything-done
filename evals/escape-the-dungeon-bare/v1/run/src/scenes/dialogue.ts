import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { content } from "../systems/content";
import { saveGame } from "../systems/gamestate";

interface DialogueParams {
  state: GameState;
  npcId: string;
}

export function setupDialogueScene(k: KAPLAYCtx) {
  k.scene("dialogue", (params: DialogueParams) => {
    const { state, npcId } = params;
    const dialogue = content.getDialogue(npcId);

    if (!dialogue) {
      // No dialogue found, go back
      k.go("game", { newGame: false, savedState: state });
      return;
    }

    let responseText: string | null = null;

    function render() {
      k.destroyAll("dlg");

      // Background
      k.add([k.rect(800, 600), k.pos(0, 0), k.color(15, 20, 30), "dlg"]);

      // NPC portrait area
      k.add([
        k.rect(120, 120, { radius: 60 }),
        k.pos(400, 100),
        k.anchor("center"),
        k.color(60, 80, 100),
        k.outline(3, k.rgb(100, 140, 180)),
        "dlg",
      ]);
      k.add([
        k.text("NPC", { size: 24 }),
        k.pos(400, 100),
        k.anchor("center"),
        k.color(200, 220, 255),
        "dlg",
      ]);

      // NPC name
      k.add([
        k.text(dialogue.npcName, { size: 22 }),
        k.pos(400, 180),
        k.anchor("center"),
        k.color(255, 220, 120),
        "dlg",
      ]);

      // Dialogue box
      k.add([
        k.rect(700, 100, { radius: 8 }),
        k.pos(400, 250),
        k.anchor("center"),
        k.color(25, 25, 40),
        k.outline(1, k.rgb(70, 70, 100)),
        "dlg",
      ]);

      const displayText = responseText ?? dialogue.greeting;
      k.add([
        k.text(displayText, { size: 14, width: 660 }),
        k.pos(70, 215),
        k.color(220, 220, 240),
        "dlg",
      ]);

      if (responseText) {
        // Show "Continue" button after a response
        const continueBtn = k.add([
          k.rect(160, 40, { radius: 6 }),
          k.pos(400, 400),
          k.anchor("center"),
          k.color(60, 60, 120),
          k.area(),
          "dlg",
        ]);
        k.add([
          k.text("Continue", { size: 16 }),
          k.pos(400, 400),
          k.anchor("center"),
          k.color(255, 255, 255),
          "dlg",
        ]);
        continueBtn.onClick(() => {
          responseText = null;
          render();
        });
      } else {
        // Show dialogue options
        dialogue.options.forEach((opt, i) => {
          const y = 330 + i * 50;
          const optBtn = k.add([
            k.rect(600, 40, { radius: 6 }),
            k.pos(400, y),
            k.anchor("center"),
            k.color(40, 50, 70),
            k.area(),
            "dlg",
          ]);
          k.add([
            k.text(opt.text, { size: 14, width: 560 }),
            k.pos(120, y - 10),
            k.color(200, 200, 220),
            "dlg",
          ]);

          optBtn.onClick(() => {
            // Apply effect
            if (opt.effect) {
              if (opt.effect.type === "give_item" && opt.effect.itemId) {
                const existing = state.player.inventory.find(
                  (inv) => inv.id === opt.effect!.itemId
                );
                if (existing) {
                  existing.quantity++;
                } else {
                  state.player.inventory.push({
                    id: opt.effect.itemId,
                    quantity: 1,
                  });
                }
              }
              if (opt.effect.type === "give_spell" && opt.effect.spellId) {
                if (!state.player.spells.includes(opt.effect.spellId)) {
                  state.player.spells.push(opt.effect.spellId);
                  state.player.preparedSpells.push(opt.effect.spellId);
                }
              }
            }
            saveGame(state);
            responseText = opt.response;
            render();
          });
        });
      }

      // Leave button
      const leaveBtn = k.add([
        k.rect(120, 35, { radius: 6 }),
        k.pos(400, 550),
        k.anchor("center"),
        k.color(100, 50, 50),
        k.area(),
        "dlg",
      ]);
      k.add([
        k.text("Leave", { size: 14 }),
        k.pos(400, 550),
        k.anchor("center"),
        k.color(255, 255, 255),
        "dlg",
      ]);
      leaveBtn.onClick(() => {
        k.go("game", { newGame: false, savedState: state });
      });
    }

    render();
  });
}
