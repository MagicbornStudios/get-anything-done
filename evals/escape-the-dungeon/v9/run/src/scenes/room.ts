import type { KAPLAYCtx } from "kaplay";
import { getState, getCurrentFloor, getCurrentRoom, discoverRoom, advanceTick, saveGame } from "../systems/gameState";
import { drawHUD, ROOM_COLORS, COLORS, getRoomIcon } from "../systems/ui";
import { loadIconSprite, GAME_ICONS } from "../systems/icons";

export function roomScene(k: KAPLAYCtx) {
  const state = getState();
  const room = getCurrentRoom();
  const floor = getCurrentFloor();
  const rc = ROOM_COLORS[room.type];

  // Auto-save on room entry
  saveGame();

  // Discover adjacent rooms
  room.exits.forEach(exit => discoverRoom(exit.targetRoom));

  // Draw HUD
  drawHUD(k);

  const contentY = 56;

  // Room background panel
  k.add([
    k.rect(k.width() - 40, k.height() - contentY - 20, { radius: 8 }),
    k.color(k.Color.fromHex(rc.bg)),
    k.outline(2, k.Color.fromHex(rc.border)),
    k.pos(20, contentY),
  ]);

  // Room type badge
  k.add([
    k.rect(100, 26, { radius: 4 }),
    k.color(k.Color.fromHex(rc.border)),
    k.pos(40, contentY + 12),
  ]);
  k.add([
    k.text(room.type.toUpperCase(), { size: 12 }),
    k.pos(90, contentY + 25),
    k.anchor("center"),
    k.color(k.Color.fromHex(rc.text)),
  ]);

  // Room icon
  const iconUrl = getRoomIcon(room.type, 64);
  const iconName = `room-icon-${room.type}`;
  k.loadSprite(iconName, iconUrl);
  // Show icon after short delay for loading
  k.wait(0.05, () => {
    try {
      k.add([
        k.sprite(iconName),
        k.pos(k.width() - 110, contentY + 20),
        k.scale(1),
      ]);
    } catch {
      // Sprite not ready yet, ignore
    }
  });

  // Room name
  k.add([
    k.text(room.name, { size: 28 }),
    k.pos(160, contentY + 16),
    k.color(k.Color.fromHex(COLORS.gold)),
  ]);

  // Floor name
  k.add([
    k.text(`${floor.name}`, { size: 14 }),
    k.pos(160, contentY + 50),
    k.color(k.Color.fromHex(COLORS.textDim)),
  ]);

  // Room description
  k.add([
    k.text(room.description, { size: 15, width: k.width() - 200 }),
    k.pos(40, contentY + 80),
    k.color(k.Color.fromHex(COLORS.text)),
  ]);

  // Divider
  k.add([
    k.rect(k.width() - 80, 1),
    k.color(k.Color.fromHex(rc.border)),
    k.pos(40, contentY + 140),
  ]);

  // Room-specific actions
  const actionY = contentY + 160;

  if (room.type === "combat" || room.type === "elite" || room.type === "boss") {
    if (!room.cleared && room.enemyId) {
      // Show encounter button
      const fightBtn = k.add([
        k.rect(200, 44, { radius: 6 }),
        k.color(k.Color.fromHex("#442222")),
        k.outline(2, k.Color.fromHex(COLORS.danger)),
        k.pos(40, actionY),
        k.area(),
      ]);
      k.add([
        k.text("Enter Combat", { size: 18 }),
        k.pos(140, actionY + 22),
        k.anchor("center"),
        k.color(k.Color.fromHex("#ff6666")),
      ]);
      fightBtn.onClick(() => {
        k.go("combat", room.enemyId!);
      });
      fightBtn.onHover(() => { fightBtn.color = k.Color.fromHex("#553333"); });
      fightBtn.onHoverEnd(() => { fightBtn.color = k.Color.fromHex("#442222"); });
    } else {
      k.add([
        k.text("This area has been cleared.", { size: 16 }),
        k.pos(40, actionY),
        k.color(k.Color.fromHex(COLORS.success)),
      ]);
    }
  } else if (room.type === "forge") {
    const forgeBtn = k.add([
      k.rect(200, 44, { radius: 6 }),
      k.color(k.Color.fromHex("#112244")),
      k.outline(2, k.Color.fromHex("#3366aa")),
      k.pos(40, actionY),
      k.area(),
    ]);
    k.add([
      k.text("Open Forge", { size: 18 }),
      k.pos(140, actionY + 22),
      k.anchor("center"),
      k.color(k.Color.fromHex("#66aaff")),
    ]);
    forgeBtn.onClick(() => {
      k.go("forge");
    });
    forgeBtn.onHover(() => { forgeBtn.color = k.Color.fromHex("#223355"); });
    forgeBtn.onHoverEnd(() => { forgeBtn.color = k.Color.fromHex("#112244"); });
  } else if (room.type === "rest") {
    const restBtn = k.add([
      k.rect(200, 44, { radius: 6 }),
      k.color(k.Color.fromHex("#112211")),
      k.outline(2, k.Color.fromHex("#336633")),
      k.pos(40, actionY),
      k.area(),
    ]);
    k.add([
      k.text("Rest Here", { size: 18 }),
      k.pos(140, actionY + 22),
      k.anchor("center"),
      k.color(k.Color.fromHex("#66ff66")),
    ]);
    restBtn.onClick(() => {
      const p = state.player;
      // Heal 40% HP and 30% mana (not full restore)
      const hpRestore = Math.floor(p.combatStats.maxHp * 0.4);
      const manaRestore = Math.floor(p.combatStats.maxMana * 0.3);
      p.combatStats.currentHp = Math.min(p.combatStats.currentHp + hpRestore, p.combatStats.maxHp);
      p.combatStats.currentMana = Math.min(p.combatStats.currentMana + manaRestore, p.combatStats.maxMana);
      room.cleared = true;
      saveGame();
      k.go("room"); // refresh
    });
    restBtn.onHover(() => { restBtn.color = k.Color.fromHex("#223322"); });
    restBtn.onHoverEnd(() => { restBtn.color = k.Color.fromHex("#112211"); });
  } else if (room.type === "dialogue" && room.npcId) {
    const talkBtn = k.add([
      k.rect(200, 44, { radius: 6 }),
      k.color(k.Color.fromHex("#222211")),
      k.outline(2, k.Color.fromHex("#444433")),
      k.pos(40, actionY),
      k.area(),
    ]);
    k.add([
      k.text("Talk to NPC", { size: 18 }),
      k.pos(140, actionY + 22),
      k.anchor("center"),
      k.color(k.Color.fromHex("#cccc66")),
    ]);
    talkBtn.onClick(() => {
      k.go("dialogue", room.npcId!);
    });
    talkBtn.onHover(() => { talkBtn.color = k.Color.fromHex("#333322"); });
    talkBtn.onHoverEnd(() => { talkBtn.color = k.Color.fromHex("#222211"); });
  }

  // Navigation exits
  const exitY = k.height() - 140;
  k.add([
    k.text("EXITS:", { size: 14 }),
    k.pos(40, exitY - 20),
    k.color(k.Color.fromHex(COLORS.textDim)),
  ]);

  room.exits.forEach((exit, i) => {
    // Check if target is on a different floor (boss cleared check)
    const targetOnThisFloor = floor.rooms.find(r => r.id === exit.targetRoom);
    const isFloorTransition = !targetOnThisFloor;

    // Boss room gate: only allow access to next floor if boss is cleared
    if (isFloorTransition) {
      const bossRoom = floor.rooms.find(r => r.id === floor.bossRoomId);
      if (bossRoom && !bossRoom.cleared) {
        // Can't go up until boss is beaten
        const blockedBtn = k.add([
          k.rect(200, 40, { radius: 4 }),
          k.color(k.Color.fromHex("#1a1a1a")),
          k.outline(1, k.Color.fromHex("#333333")),
          k.pos(40 + i * 220, exitY),
          k.area(),
        ]);
        k.add([
          k.text(`${exit.direction}: ${exit.label}`, { size: 13 }),
          k.pos(140 + i * 220, exitY + 12),
          k.anchor("center"),
          k.color(k.Color.fromHex("#555555")),
        ]);
        k.add([
          k.text("[Boss not defeated]", { size: 10 }),
          k.pos(140 + i * 220, exitY + 28),
          k.anchor("center"),
          k.color(k.Color.fromHex(COLORS.danger)),
        ]);
        return;
      }
    }

    // Determine target room color for the exit button
    let targetType: string = "start";
    if (targetOnThisFloor) {
      targetType = targetOnThisFloor.type;
    }
    const targetColors = ROOM_COLORS[targetType as keyof typeof ROOM_COLORS] || ROOM_COLORS.start;

    const exitBtn = k.add([
      k.rect(200, 40, { radius: 4 }),
      k.color(k.Color.fromHex(COLORS.buttonBg)),
      k.outline(1, k.Color.fromHex(targetColors.border)),
      k.pos(40 + i * 220, exitY),
      k.area(),
    ]);
    k.add([
      k.text(`${exit.direction}: ${exit.label}`, { size: 13 }),
      k.pos(140 + i * 220, exitY + 12),
      k.anchor("center"),
      k.color(k.Color.fromHex(targetColors.text)),
    ]);

    if (targetOnThisFloor) {
      k.add([
        k.text(`[${targetOnThisFloor.type}]`, { size: 10 }),
        k.pos(140 + i * 220, exitY + 28),
        k.anchor("center"),
        k.color(k.Color.fromHex(COLORS.textDim)),
      ]);
    }

    exitBtn.onClick(() => {
      state.player.currentRoom = exit.targetRoom;

      // Floor transition
      if (isFloorTransition) {
        const nextFloor = state.floors.find(f => f.rooms.some(r => r.id === exit.targetRoom));
        if (nextFloor) {
          state.player.currentFloor = nextFloor.id;
          discoverRoom(exit.targetRoom);
        }
      }

      advanceTick();
      discoverRoom(exit.targetRoom);
      saveGame();
      k.go("room");
    });

    exitBtn.onHover(() => { exitBtn.color = k.Color.fromHex(COLORS.buttonHover); });
    exitBtn.onHoverEnd(() => { exitBtn.color = k.Color.fromHex(COLORS.buttonBg); });
  });
}
