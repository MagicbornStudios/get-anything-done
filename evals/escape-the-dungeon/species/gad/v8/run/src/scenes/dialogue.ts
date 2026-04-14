// Dialogue scene - NPC conversations with branching choices
import type { KAPLAYCtx } from "kaplay";
import {
  getPlayer, addItem, addRune, addXp, addSpell,
  markRoomCleared, saveGame,
} from "../systems/gamestate";
import { NPCS } from "../data/content";
import { drawNPCPortrait } from "../systems/draw";
import type { DialogueEffect } from "../types";

let currentNodeIndex = 0;

export function dialogueScene(k: KAPLAYCtx, npcId: string) {
  currentNodeIndex = 0;
  renderDialogue(k, npcId);
}

function renderDialogue(k: KAPLAYCtx, npcId: string) {
  k.destroyAll("*");

  const W = k.width();
  const H = k.height();
  const player = getPlayer();
  const npc = NPCS[npcId];

  if (!npc) {
    k.go("room");
    return;
  }

  const node = npc.dialogue[currentNodeIndex];
  if (!node) {
    // End of dialogue
    markRoomCleared(player.currentRoomId);
    saveGame();
    k.go("room");
    return;
  }

  // Background
  k.add([
    k.rect(W, H),
    k.pos(0, 0),
    k.color(10, 18, 12),
    "bg",
  ]);

  // Title bar
  k.add([
    k.rect(W, 40),
    k.pos(0, 0),
    k.color(15, 25, 18),
    "bg",
  ]);
  k.add([
    k.rect(W, 3),
    k.pos(0, 37),
    k.color(60, 160, 80),
    "bg",
  ]);
  k.add([
    k.text(`\u{1F4AC} ${npc.name}`, { size: 20, font: "monospace" }),
    k.pos(15, 8),
    k.color(120, 220, 140),
    "bg",
  ]);

  // NPC portrait panel
  k.add([
    k.rect(200, 200, { radius: 12 }),
    k.pos(W / 2 - 100, 55),
    k.color(18, 28, 20),
    k.outline(2, k.Color.fromHex(npc.portraitColor)),
    "bg",
  ]);

  // Draw NPC portrait using canvas
  const portraitObj = k.add([
    k.pos(W / 2, 155),
    k.rect(1, 1),
    k.opacity(0),
    "bg",
  ]);
  portraitObj.onDraw(() => {
    const canvas = k.canvas;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      drawNPCPortrait(ctx, W / 2, 155, 160, npc.portraitColor);
    }
  });

  // NPC name under portrait
  k.add([
    k.text(npc.name, { size: 16, font: "monospace" }),
    k.pos(W / 2, 268),
    k.anchor("center"),
    k.color(k.Color.fromHex(npc.portraitColor)),
    "bg",
  ]);

  // Dialogue text panel
  const textY = 295;
  k.add([
    k.rect(W - 40, 100, { radius: 10 }),
    k.pos(20, textY),
    k.color(15, 22, 18),
    k.outline(2, k.Color.fromArray([50, 90, 60])),
    "bg",
  ]);

  k.add([
    k.text(node.text, { size: 15, font: "monospace", width: W - 80 }),
    k.pos(35, textY + 15),
    k.color(200, 220, 210),
    "bg",
  ]);

  // Choice buttons
  const choiceY = textY + 115;
  const choices = node.choices ?? [];

  if (choices.length === 0) {
    // End of conversation - auto leave button
    const leaveBtn = k.add([
      k.rect(260, 44, { radius: 8 }),
      k.pos(W / 2, choiceY + 20),
      k.anchor("center"),
      k.color(25, 35, 28),
      k.outline(2, k.Color.fromArray([80, 160, 100])),
      k.area(),
      "choice-btn",
    ]);
    k.add([
      k.text("\u{2705} End Conversation", { size: 15, font: "monospace" }),
      k.pos(W / 2, choiceY + 20),
      k.anchor("center"),
      k.color(120, 220, 140),
      "bg",
    ]);
    leaveBtn.onHoverUpdate(() => {
      leaveBtn.color = k.Color.fromArray([35, 50, 40]);
      k.setCursor("pointer");
    });
    leaveBtn.onHoverEnd(() => {
      leaveBtn.color = k.Color.fromArray([25, 35, 28]);
      k.setCursor("default");
    });
    leaveBtn.onClick(() => {
      markRoomCleared(player.currentRoomId);
      saveGame();
      k.go("room");
    });
  } else {
    choices.forEach((choice, i) => {
      const btnY = choiceY + i * 50;
      const btn = k.add([
        k.rect(W - 80, 42, { radius: 6 }),
        k.pos(W / 2, btnY),
        k.anchor("center"),
        k.color(22, 30, 25),
        k.outline(2, k.Color.fromArray([60, 120, 80])),
        k.area(),
        "choice-btn",
      ]);

      const effectText = choice.effect ? getEffectPreview(choice.effect) : "";
      k.add([
        k.text(`${choice.text}${effectText}`, { size: 14, font: "monospace", width: W - 120 }),
        k.pos(W / 2, btnY),
        k.anchor("center"),
        k.color(190, 210, 200),
        "bg",
      ]);

      btn.onHoverUpdate(() => {
        btn.color = k.Color.fromArray([35, 50, 40]);
        k.setCursor("pointer");
      });
      btn.onHoverEnd(() => {
        btn.color = k.Color.fromArray([22, 30, 25]);
        k.setCursor("default");
      });

      btn.onClick(() => {
        // Apply effect
        if (choice.effect) {
          applyEffect(choice.effect);
        }
        // Navigate to next dialogue node
        if (choice.nextIndex !== undefined) {
          currentNodeIndex = choice.nextIndex;
          renderDialogue(k, npcId);
        } else {
          markRoomCleared(player.currentRoomId);
          saveGame();
          k.go("room");
        }
      });
    });
  }
}

function applyEffect(effect: DialogueEffect) {
  switch (effect.type) {
    case "give_item":
      if (effect.itemId) addItem(effect.itemId);
      break;
    case "give_rune":
      if (effect.runeId) addRune(effect.runeId);
      break;
    case "give_xp":
      if (effect.amount) addXp(effect.amount);
      break;
    case "heal":
      if (effect.amount) {
        const player = getPlayer();
        player.stats.currentHp = Math.min(player.stats.maxHp, player.stats.currentHp + effect.amount);
      }
      break;
    case "teach_spell":
      // Not used yet but supported
      break;
  }
}

function getEffectPreview(effect: DialogueEffect): string {
  switch (effect.type) {
    case "give_item": return "  [\u{1F381} Item]";
    case "give_rune": return "  [\u{2728} Rune]";
    case "give_xp": return `  [+${effect.amount} XP]`;
    case "heal": return `  [+${effect.amount} HP]`;
    case "teach_spell": return "  [\u{1F4DA} Spell]";
    default: return "";
  }
}
