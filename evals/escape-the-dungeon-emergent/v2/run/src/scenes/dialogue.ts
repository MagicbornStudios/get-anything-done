// Dialogue scene — NPC interactions
// Must always return to room scene after

import type { KAPLAYCtx } from "kaplay";
import type { GameState } from "../types";
import { getContent } from "../content";
import { saveGame } from "../state";
import {
  COLORS,
  addButton,
  addPanel,
  addEntityPortrait,
  addTitle,
  addLabel,
} from "../ui";

const TAG = "dlg-ui";

export function registerDialogueScene(k: KAPLAYCtx): void {
  k.scene("dialogue", (sceneData: { gameState: GameState; npcId: string }) => {
    const gs = sceneData.gameState;
    const content = getContent();
    const npc = content.npcs.find((n) => n.id === sceneData.npcId);

    if (!npc) {
      k.go("room", { gameState: gs });
      return;
    }

    renderDialogue(k, gs, npc.id, null);
  });
}

function renderDialogue(
  k: KAPLAYCtx,
  gs: GameState,
  npcId: string,
  responseText: string | null
): void {
  k.destroyAll(TAG);

  const content = getContent();
  const npc = content.npcs.find((n) => n.id === npcId);
  if (!npc) return;

  const W = k.width();
  const H = k.height();
  const cx = W / 2;

  // Background
  addPanel(k, cx, H / 2, W - 30, H - 30, TAG, {
    color: [18, 20, 28],
    borderColor: COLORS.dialogue,
  });

  // NPC portrait
  addEntityPortrait(k, 100, 120, npc.color, npc.icon, 90, TAG);

  // NPC name
  addTitle(k, npc.name, 260, 85, TAG, { size: 26, color: COLORS.dialogue });

  // Dialogue text panel
  addPanel(k, cx, 200, W - 100, 100, TAG, {
    color: [22, 24, 36],
    borderColor: COLORS.panelBorder,
  });

  const displayText = responseText || npc.greeting;
  // Split long text into lines (no KAPLAY styled tags — avoids crash)
  const maxLineLen = 70;
  const words = displayText.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxLineLen) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += " " + word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  lines.forEach((line, i) => {
    addLabel(k, line, 80, 168 + i * 20, TAG, {
      size: 15,
      color: COLORS.text,
    });
  });

  // Dialogue options (only show if we're in greeting mode)
  if (!responseText) {
    npc.dialogue.forEach((option, i) => {
      const y = 300 + i * 55;

      // Check if option is affordable (for buy options)
      let affordable = true;
      if (option.effect?.type === "buy" || option.effect?.type === "buyRune") {
        const cost = option.effect.cost || 0;
        affordable = gs.player.crystals >= cost;
      }

      addButton(k, option.text, cx, y, {
        tag: TAG,
        width: 440,
        height: 42,
        color: affordable ? COLORS.dialogue : [50, 50, 70],
        fontSize: 15,
        onClick: () => {
          if (!affordable) return;
          // Apply effect
          applyDialogueEffect(gs, option.effect);
          saveGame(gs);
          // Show response
          renderDialogue(k, gs, npcId, option.response);
        },
      });
    });
  }

  // Leave button (always available)
  addButton(k, "Leave", cx, H - 70, {
    tag: TAG,
    width: 180,
    height: 44,
    color: COLORS.textDim,
    fontSize: 18,
    onClick: () => {
      // CRITICAL: Return to room scene
      k.go("room", { gameState: gs });
    },
  });
}

function applyDialogueEffect(gs: GameState, effect: { type: string; amount?: number; runeId?: string; item?: string; cost?: number } | null): void {
  if (!effect) return;

  switch (effect.type) {
    case "heal":
      gs.player.combatStats.currentHp = Math.min(
        gs.player.combatStats.maxHp,
        gs.player.combatStats.currentHp + (effect.amount || 20)
      );
      break;

    case "giveRune":
      if (effect.runeId) {
        gs.player.runes.push(effect.runeId);
      }
      break;

    case "buy":
      if (effect.item && effect.cost && gs.player.crystals >= effect.cost) {
        gs.player.crystals -= effect.cost;
        gs.player.items[effect.item] = (gs.player.items[effect.item] || 0) + 1;
      }
      break;

    case "buyRune":
      if (effect.runeId && effect.cost && gs.player.crystals >= effect.cost) {
        gs.player.crystals -= effect.cost;
        gs.player.runes.push(effect.runeId);
      }
      break;
  }
}
