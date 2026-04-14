import { makeButton, addCenteredText } from "../systems/ui";
import { getPlayer, saveGame, addItem } from "../systems/state";
import { content } from "../systems/content";

export interface DialogueResponseData {
  npcId: string;
  choiceText: string;
  response: string;
  effect: any;
}

export function dialogueScene(k: any, npcId: string) {
  const player = getPlayer();
  const npc = content.getNpc(npcId);

  if (!npc) {
    addCenteredText(k, "Nobody here.", k.height() / 2, 20);
    makeButton(k, {
      label: "Back",
      x: k.width() / 2,
      y: k.height() - 60,
      onClick: () => k.go("room"),
    });
    return;
  }

  const entityType = content.getEntityType(npc.entityType);
  const col = entityType?.spriteColor ?? [200, 200, 200];

  // NPC portrait
  k.add([
    k.rect(70, 70, { radius: 35 }),
    k.pos(k.width() / 2, 60),
    k.color(col[0], col[1], col[2]),
    k.anchor("center"),
    k.z(10),
  ]);

  addCenteredText(k, npc.name, 110, 22, [150, 200, 255]);
  addCenteredText(k, `"${npc.greeting}"`, 145, 15, [220, 220, 240]);

  // Dialogue options
  let y = 190;
  npc.dialogueOptions.forEach((opt) => {
    makeButton(k, {
      label: opt.text,
      x: k.width() / 2,
      y,
      width: 340,
      height: 38,
      fontSize: 13,
      onClick: () => {
        const data: DialogueResponseData = {
          npcId,
          choiceText: opt.text,
          response: opt.response,
          effect: opt.effect,
        };
        k.go("dialogueResponse", data);
      },
    });
    y += 48;
  });
}

export function dialogueResponseScene(k: any, data: DialogueResponseData) {
  const player = getPlayer();
  const npc = content.getNpc(data.npcId);
  const npcName = npc?.name ?? "NPC";

  addCenteredText(k, npcName, 40, 22, [150, 200, 255]);

  // Player's choice
  addCenteredText(k, `You: "${data.choiceText}"`, 80, 14, [180, 200, 180]);

  // NPC response
  addCenteredText(k, `"${data.response}"`, 120, 16, [220, 220, 240]);

  // Apply effect
  let effectMsg = "";
  const effect = data.effect;
  if (effect) {
    if (effect.type === "give_item" && effect.itemId) {
      addItem(effect.itemId);
      const item = content.getItem(effect.itemId);
      effectMsg = `Received: ${item?.name ?? effect.itemId}!`;
    } else if (effect.type === "buy_item" && effect.itemId && effect.cost) {
      if (player.crystals >= effect.cost) {
        player.crystals -= effect.cost;
        addItem(effect.itemId);
        const item = content.getItem(effect.itemId);
        effectMsg = `Bought ${item?.name ?? effect.itemId} for ${effect.cost} crystals!`;
      } else {
        effectMsg = "Not enough crystals!";
      }
    }
  }

  if (effectMsg) {
    addCenteredText(k, effectMsg, 165, 16, [220, 200, 100]);
  }

  saveGame();

  makeButton(k, {
    label: "Continue talking",
    x: k.width() / 2,
    y: k.height() - 100,
    width: 200,
    height: 40,
    onClick: () => k.go("dialogue", data.npcId),
  });

  makeButton(k, {
    label: "Leave",
    x: k.width() / 2,
    y: k.height() - 50,
    width: 200,
    height: 40,
    onClick: () => k.go("room"),
  });
}
