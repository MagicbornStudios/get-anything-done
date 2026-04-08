import type { KAPLAYCtx } from "kaplay";
import { makeButton, makeText, makePanel, makeHpBar, COLORS } from "../ui";
import { getState, saveGame } from "../state";
import { ContentManager } from "../content";

const TAG = "room-ui";

export function roomScene(k: KAPLAYCtx) {
  k.destroyAll(TAG);

  const state = getState();
  if (!state) {
    k.go("title");
    return;
  }

  const player = state.player;
  const room = ContentManager.getRoom(player.currentFloorId, player.currentRoomId);
  const floor = ContentManager.getFloor(player.currentFloorId);

  if (!room || !floor) {
    k.go("title");
    return;
  }

  // Auto-save on room entry
  saveGame();

  // -- HUD at top --
  makePanel(k, 400, 30, 780, 50, TAG, [25, 25, 40]);

  makeText(k, `${player.name} | Lv.${player.level}`, 30, 30, TAG, {
    size: 14,
    anchor: "left",
    color: COLORS.accent,
  });

  // HP bar
  makeText(k, "HP", 250, 22, TAG, { size: 10, anchor: "left", color: COLORS.hp });
  makeHpBar(k, 270, 22, 120, player.stats.currentHp, player.stats.maxHp, TAG, COLORS.hp);

  // Mana bar
  makeText(k, "MP", 250, 40, TAG, { size: 10, anchor: "left", color: COLORS.mana });
  makeHpBar(k, 270, 40, 120, player.stats.currentMana, player.stats.maxMana, TAG, COLORS.mana);

  // Floor + tick
  makeText(k, `${floor.name} | Tick: ${player.dungeonTick}`, 550, 22, TAG, {
    size: 12,
    anchor: "left",
    color: COLORS.textDim,
  });

  // Crystals
  makeText(k, `Crystals: ${player.crystals}`, 550, 40, TAG, {
    size: 12,
    anchor: "left",
    color: COLORS.gold,
  });

  // -- Room info --
  makePanel(k, 400, 180, 700, 180, TAG);

  makeText(k, room.name, 400, 110, TAG, {
    size: 24,
    color: COLORS.accent,
  });

  // Room type badge
  const featureColors: Record<string, [number, number, number]> = {
    combat: COLORS.danger,
    boss: COLORS.danger,
    dialogue: COLORS.accent,
    treasure: COLORS.gold,
    rest: COLORS.success,
    start: COLORS.textDim,
  };

  makeText(k, `[${room.feature.toUpperCase()}]`, 400, 140, TAG, {
    size: 14,
    color: featureColors[room.feature] ?? COLORS.textDim,
  });

  makeText(k, room.description, 400, 190, TAG, {
    size: 14,
    color: COLORS.text,
    width: 650,
  });

  // -- Room feature action --
  let actionY = 300;

  if (room.feature === "combat" || room.feature === "boss") {
    const enemy = ContentManager.getEnemyForRoom(room);
    if (enemy) {
      makeButton(k, `Fight ${enemy.name}!`, 400, actionY, 250, 45, TAG, () => {
        k.go("combat", { enemyId: room.enemyId, isBoss: room.feature === "boss" });
      }, COLORS.danger);
      actionY += 60;
    }
  } else if (room.feature === "dialogue") {
    makeButton(k, "Talk", 400, actionY, 200, 45, TAG, () => {
      k.go("dialogue", { dialogueId: room.dialogueId });
    }, COLORS.accent);
    actionY += 60;
  } else if (room.feature === "treasure") {
    makeButton(k, "Open Chest", 400, actionY, 200, 45, TAG, () => {
      // Give item
      if (room.treasureItemId) {
        const existing = player.inventory.find((i) => i.itemId === room.treasureItemId);
        if (existing) {
          existing.quantity += 1;
        } else {
          player.inventory.push({ itemId: room.treasureItemId!, quantity: 1 });
        }
        saveGame();
      }
      // Change room feature to prevent re-looting
      (room as any).feature = "start";
      k.go("room");
    }, COLORS.gold);
    actionY += 60;
  } else if (room.feature === "rest") {
    makeButton(k, "Rest (Heal Full)", 400, actionY, 200, 45, TAG, () => {
      player.stats.currentHp = player.stats.maxHp;
      player.stats.currentMana = player.stats.maxMana;
      saveGame();
      k.go("room");
    }, COLORS.success);
    actionY += 60;
  }

  // -- Menu buttons --
  const menuY = actionY + 10;
  const menuBtnW = 90;
  const menuStartX = 400 - (menuBtnW * 2 + 30);

  makeButton(k, "Stats", menuStartX, menuY, menuBtnW, 35, TAG, () => {
    k.go("stats");
  }, COLORS.panelLight);

  makeButton(k, "Bag", menuStartX + menuBtnW + 15, menuY, menuBtnW, 35, TAG, () => {
    k.go("bag");
  }, COLORS.panelLight);

  makeButton(k, "Spells", menuStartX + (menuBtnW + 15) * 2, menuY, menuBtnW, 35, TAG, () => {
    k.go("spellbook");
  }, COLORS.panelLight);

  makeButton(k, "Map", menuStartX + (menuBtnW + 15) * 3, menuY, menuBtnW, 35, TAG, () => {
    k.go("map");
  }, COLORS.panelLight);

  // -- Navigation exits --
  const exitStartY = menuY + 60;
  makeText(k, "Exits:", 400, exitStartY, TAG, {
    size: 16,
    color: COLORS.textDim,
  });

  room.exits.forEach((exit, i) => {
    const targetRoom = ContentManager.getRoom(player.currentFloorId, exit.targetRoomId);
    const label = targetRoom
      ? `${exit.direction} - ${targetRoom.name} (${targetRoom.feature})`
      : `${exit.direction}`;

    makeButton(k, label, 400, exitStartY + 40 + i * 50, 400, 40, TAG, () => {
      player.currentRoomId = exit.targetRoomId;
      player.dungeonTick += 1;

      // Discover room
      if (!player.discoveredRooms.includes(exit.targetRoomId)) {
        player.discoveredRooms.push(exit.targetRoomId);
      }

      saveGame();
      k.go("room");
    });
  });
}
