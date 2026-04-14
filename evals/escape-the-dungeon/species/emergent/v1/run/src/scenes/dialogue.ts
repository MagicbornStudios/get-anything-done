import type { KAPLAYCtx } from "kaplay";
import { makeButton, makeText, makePanel, COLORS } from "../ui";
import { getState, saveGame } from "../state";
import { ContentManager } from "../content";

const TAG = "dlg-ui";

function renderDialogue(k: KAPLAYCtx, dialogueId: string) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state) {
    k.go("title");
    return;
  }

  const node = ContentManager.getDialogue(dialogueId);
  if (!node) {
    // No more dialogue, return to room
    k.go("room");
    return;
  }

  const player = state.player;

  // NPC portrait placeholder
  makePanel(k, 400, 150, 600, 200, TAG);

  // NPC sprite placeholder
  k.add([
    k.rect(70, 70, { radius: 35 }),
    k.pos(180, 120),
    k.anchor("center"),
    k.color(...COLORS.accent),
    TAG,
  ]);
  makeText(k, node.npcName[0], 180, 120, TAG, { size: 36, color: COLORS.text });

  // NPC name
  makeText(k, node.npcName, 180, 170, TAG, {
    size: 16,
    color: COLORS.accent,
  });

  // Dialogue text
  makeText(k, node.text, 450, 120, TAG, {
    size: 15,
    color: COLORS.text,
    anchor: "left",
    width: 350,
  });

  // Options
  node.options.forEach((option, i) => {
    makeButton(k, option.text, 400, 300 + i * 55, 550, 40, TAG, () => {
      // Apply effects
      if (option.giveItem) {
        const existing = player.inventory.find((inv) => inv.itemId === option.giveItem);
        if (existing) {
          existing.quantity += 1;
        } else {
          player.inventory.push({ itemId: option.giveItem!, quantity: 1 });
        }
      }

      if (option.healHp) {
        player.stats.currentHp = Math.min(
          player.stats.maxHp,
          player.stats.currentHp + option.healHp
        );
      }

      saveGame();

      if (option.next) {
        renderDialogue(k, option.next);
      } else {
        k.go("room");
      }
    }, COLORS.panelLight);
  });
}

export function dialogueScene(k: KAPLAYCtx, data: { dialogueId: string }) {
  renderDialogue(k, data.dialogueId);
}
