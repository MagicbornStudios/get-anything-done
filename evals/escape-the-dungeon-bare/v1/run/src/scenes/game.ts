import type { KAPLAYCtx } from "kaplay";
import type { GameState, RoomData } from "../types";
import { content } from "../systems/content";
import {
  createPlayer,
  createGameState,
  saveGame,
} from "../systems/gamestate";

export function setupGameScene(k: KAPLAYCtx) {
  k.scene(
    "game",
    (params: { newGame: boolean; savedState?: GameState }) => {
      let state: GameState;

      if (params.newGame || !params.savedState) {
        const player = createPlayer("Adventurer", "human", "warrior");
        // Give starting spells
        player.spells = ["fireball", "ice_shard", "heal"];
        player.preparedSpells = ["fireball", "ice_shard", "heal"];
        state = createGameState(player);
      } else {
        state = params.savedState;
      }

      // Track menu state
      let menuOpen: string | null = null;

      function getCurrentRoom(): RoomData | undefined {
        return content.getRoom(state.currentFloor, state.currentRoomId);
      }

      function discoverAdjacentRooms(room: RoomData) {
        for (const targetId of Object.values(room.exits)) {
          if (!state.discoveredRooms.includes(targetId)) {
            state.discoveredRooms.push(targetId);
          }
        }
      }

      function renderAll() {
        // Destroy everything and re-render
        k.destroyAll("ui");
        k.destroyAll("hud");
        k.destroyAll("menu");

        renderHUD();
        renderRoom();
        if (menuOpen) renderMenu(menuOpen);
      }

      function renderHUD() {
        const p = state.player;
        const barW = 150;
        const barH = 16;

        // HUD background
        k.add([
          k.rect(800, 60),
          k.pos(0, 0),
          k.color(10, 10, 20),
          "hud",
        ]);

        // Player name and level
        k.add([
          k.text(`${p.name} Lv.${p.level}`, { size: 16 }),
          k.pos(10, 8),
          k.color(255, 255, 255),
          "hud",
        ]);

        // HP bar background
        k.add([
          k.rect(barW, barH),
          k.pos(10, 34),
          k.color(60, 20, 20),
          "hud",
        ]);

        // HP bar fill
        const hpRatio = p.combatStats.currentHp / p.combatStats.maxHp;
        k.add([
          k.rect(Math.max(0, barW * hpRatio), barH),
          k.pos(10, 34),
          k.color(200, 50, 50),
          "hud",
        ]);

        // HP text
        k.add([
          k.text(`HP ${p.combatStats.currentHp}/${p.combatStats.maxHp}`, {
            size: 12,
          }),
          k.pos(15, 36),
          k.color(255, 255, 255),
          "hud",
        ]);

        // Mana bar background
        k.add([
          k.rect(barW, barH),
          k.pos(170, 34),
          k.color(20, 20, 60),
          "hud",
        ]);

        // Mana bar fill
        const manaRatio = p.combatStats.currentMana / p.combatStats.maxMana;
        k.add([
          k.rect(Math.max(0, barW * manaRatio), barH),
          k.pos(170, 34),
          k.color(50, 50, 200),
          "hud",
        ]);

        // Mana text
        k.add([
          k.text(
            `MP ${p.combatStats.currentMana}/${p.combatStats.maxMana}`,
            { size: 12 }
          ),
          k.pos(175, 36),
          k.color(255, 255, 255),
          "hud",
        ]);

        // Floor info
        const floor = content.getFloor(state.currentFloor);
        k.add([
          k.text(`Floor ${state.currentFloor + 1}: ${floor?.name ?? "???"}`, {
            size: 14,
          }),
          k.pos(400, 8),
          k.color(200, 200, 220),
          "hud",
        ]);

        // Tick and crystals
        k.add([
          k.text(`Tick: ${state.dungeonTick}  Crystals: ${state.player.crystals}`, {
            size: 12,
          }),
          k.pos(400, 30),
          k.color(180, 180, 200),
          "hud",
        ]);

        // XP bar
        k.add([
          k.text(
            `XP: ${state.player.xp}/${state.player.xpToNext}`,
            { size: 12 }
          ),
          k.pos(400, 46),
          k.color(150, 200, 150),
          "hud",
        ]);

        // Menu buttons at top right
        const menuItems = ["Map", "Bag", "Stats"];
        menuItems.forEach((label, i) => {
          const btnX = 640 + i * 55;
          const btn = k.add([
            k.rect(50, 24, { radius: 4 }),
            k.pos(btnX, 6),
            k.color(menuOpen === label ? 80 : 50, 50, 80),
            k.area(),
            "hud",
            "menubtn",
          ]);
          k.add([
            k.text(label, { size: 12 }),
            k.pos(btnX + 25, 18),
            k.anchor("center"),
            k.color(200, 200, 220),
            "hud",
          ]);
          btn.onClick(() => {
            menuOpen = menuOpen === label ? null : label;
            renderAll();
          });
        });

        // HUD border
        k.add([
          k.rect(800, 2),
          k.pos(0, 58),
          k.color(60, 60, 80),
          "hud",
        ]);
      }

      function renderRoom() {
        const room = getCurrentRoom();
        if (!room) return;

        // Room area background
        k.add([
          k.rect(780, 200),
          k.pos(10, 70),
          k.color(25, 25, 40),
          k.outline(1, k.rgb(60, 60, 80)),
          "ui",
        ]);

        // Room name
        k.add([
          k.text(room.name, { size: 24 }),
          k.pos(30, 85),
          k.color(255, 220, 120),
          "ui",
        ]);

        // Room type badge
        const featureColors: Record<string, [number, number, number]> = {
          start: [60, 120, 60],
          combat: [180, 50, 50],
          dialogue: [50, 120, 180],
          treasure: [200, 180, 50],
          rest: [60, 180, 60],
          forge: [180, 100, 50],
          boss: [200, 50, 200],
        };
        const fc = featureColors[room.feature] ?? [100, 100, 100];
        k.add([
          k.rect(80, 22, { radius: 4 }),
          k.pos(30, 118),
          k.color(fc[0], fc[1], fc[2]),
          "ui",
        ]);
        k.add([
          k.text(room.feature.toUpperCase(), { size: 11 }),
          k.pos(70, 129),
          k.anchor("center"),
          k.color(255, 255, 255),
          "ui",
        ]);

        // Room description
        k.add([
          k.text(room.description, { size: 14, width: 740 }),
          k.pos(30, 150),
          k.color(200, 200, 220),
          "ui",
        ]);

        // Already cleared indicator
        if (state.clearedRooms.includes(room.id)) {
          k.add([
            k.text("[CLEARED]", { size: 12 }),
            k.pos(120, 120),
            k.color(100, 200, 100),
            "ui",
          ]);
        }

        // Room-specific actions
        renderRoomActions(room);

        // Navigation buttons
        renderNavigation(room);
      }

      function renderRoomActions(room: RoomData) {
        const actionY = 290;

        if (
          room.feature === "combat" &&
          !state.clearedRooms.includes(room.id)
        ) {
          const fightBtn = k.add([
            k.rect(200, 40, { radius: 6 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(180, 50, 50),
            k.area(),
            "ui",
          ]);
          k.add([
            k.text("Enter Combat!", { size: 18 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(255, 255, 255),
            "ui",
          ]);
          fightBtn.onClick(() => {
            k.go("combat", {
              state,
              roomId: room.id,
              enemyId: room.enemyId ?? "goblin",
              enemyArchetype: room.enemyArchetype ?? "warrior",
              isBoss: false,
            });
          });
        }

        if (
          room.feature === "boss" &&
          !state.clearedRooms.includes(room.id)
        ) {
          const bossBtn = k.add([
            k.rect(200, 40, { radius: 6 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(200, 50, 200),
            k.area(),
            "ui",
          ]);
          k.add([
            k.text(`Fight ${room.bossName ?? "Boss"}!`, { size: 18 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(255, 255, 255),
            "ui",
          ]);
          bossBtn.onClick(() => {
            k.go("combat", {
              state,
              roomId: room.id,
              enemyId: room.enemyId ?? "goblin",
              enemyArchetype: room.enemyArchetype ?? "warrior",
              isBoss: true,
              bossName: room.bossName,
              bossStats: room.bossStats,
            });
          });
        }

        if (
          room.feature === "dialogue" &&
          room.npcId
        ) {
          const talkBtn = k.add([
            k.rect(200, 40, { radius: 6 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(50, 120, 180),
            k.area(),
            "ui",
          ]);
          k.add([
            k.text("Talk to NPC", { size: 18 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(255, 255, 255),
            "ui",
          ]);
          talkBtn.onClick(() => {
            k.go("dialogue", { state, npcId: room.npcId! });
          });
        }

        if (
          room.feature === "treasure" &&
          !state.clearedRooms.includes(room.id) &&
          room.loot
        ) {
          const lootBtn = k.add([
            k.rect(200, 40, { radius: 6 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(200, 180, 50),
            k.area(),
            "ui",
          ]);
          k.add([
            k.text("Open Chest", { size: 18 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(0, 0, 0),
            "ui",
          ]);
          lootBtn.onClick(() => {
            // Collect loot
            if (room.loot) {
              state.player.crystals += room.loot.crystals;
              if (room.loot.itemId) {
                const existing = state.player.inventory.find(
                  (inv) => inv.id === room.loot!.itemId
                );
                if (existing) {
                  existing.quantity++;
                } else {
                  state.player.inventory.push({
                    id: room.loot.itemId,
                    quantity: 1,
                  });
                }
              }
              state.clearedRooms.push(room.id);
              saveGame(state);
              renderAll();
            }
          });
        }

        if (room.feature === "rest") {
          const restBtn = k.add([
            k.rect(200, 40, { radius: 6 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(60, 180, 60),
            k.area(),
            "ui",
          ]);
          k.add([
            k.text("Rest & Heal", { size: 18 }),
            k.pos(400, actionY),
            k.anchor("center"),
            k.color(255, 255, 255),
            "ui",
          ]);
          restBtn.onClick(() => {
            state.player.combatStats.currentHp =
              state.player.combatStats.maxHp;
            state.player.combatStats.currentMana =
              state.player.combatStats.maxMana;
            saveGame(state);
            renderAll();
          });
        }
      }

      function renderNavigation(room: RoomData) {
        const exits = Object.entries(room.exits);
        if (exits.length === 0 && state.clearedRooms.includes(room.id)) {
          // Boss defeated, show next floor button
          if (room.feature === "boss") {
            const nextFloorIdx = state.currentFloor + 1;
            const nextFloor = content.getFloor(nextFloorIdx);
            if (nextFloor) {
              const btn = k.add([
                k.rect(250, 45, { radius: 6 }),
                k.pos(400, 500),
                k.anchor("center"),
                k.color(200, 180, 50),
                k.area(),
                "ui",
              ]);
              k.add([
                k.text(`Descend to ${nextFloor.name}`, { size: 16 }),
                k.pos(400, 500),
                k.anchor("center"),
                k.color(0, 0, 0),
                "ui",
              ]);
              btn.onClick(() => {
                state.currentFloor = nextFloorIdx;
                const startRoom = nextFloor.rooms.find(
                  (r) => r.feature === "start"
                );
                state.currentRoomId =
                  startRoom?.id ?? nextFloor.rooms[0].id;
                state.discoveredRooms.push(state.currentRoomId);
                saveGame(state);
                renderAll();
              });
            } else {
              // Victory - escaped the dungeon!
              k.go("victory", { state });
            }
          }
          return;
        }

        k.add([
          k.text("Exits:", { size: 16 }),
          k.pos(30, 360),
          k.color(200, 200, 220),
          "ui",
        ]);

        const dirSymbols: Record<string, string> = {
          north: "\u2191 North",
          south: "\u2193 South",
          east: "\u2192 East",
          west: "\u2190 West",
        };

        exits.forEach(([dir, targetId], i) => {
          const targetRoom = content.getRoom(state.currentFloor, targetId);
          const discovered = state.discoveredRooms.includes(targetId);
          const cleared = state.clearedRooms.includes(targetId);
          const roomLabel = discovered
            ? `${targetRoom?.name ?? targetId} (${targetRoom?.feature ?? "?"})`
            : "???";

          const btnX = 30 + (i % 2) * 380;
          const btnY = 390 + Math.floor(i / 2) * 55;

          const navBtn = k.add([
            k.rect(360, 45, { radius: 6 }),
            k.pos(btnX, btnY),
            k.color(40, 50, 70),
            k.area(),
            "ui",
          ]);

          // Direction label
          k.add([
            k.text(
              `${dirSymbols[dir] ?? dir}: ${roomLabel}${cleared ? " [CLEAR]" : ""}`,
              { size: 13, width: 340 }
            ),
            k.pos(btnX + 10, btnY + 14),
            k.color(200, 200, 220),
            "ui",
          ]);

          navBtn.onClick(() => {
            state.currentRoomId = targetId;
            state.dungeonTick++;
            if (!state.discoveredRooms.includes(targetId)) {
              state.discoveredRooms.push(targetId);
            }
            // Discover adjacent rooms of new room
            const newRoom = getCurrentRoom();
            if (newRoom) discoverAdjacentRooms(newRoom);
            saveGame(state);
            menuOpen = null;
            renderAll();
          });
        });
      }

      function renderMenu(name: string) {
        // Menu overlay background
        k.add([
          k.rect(500, 400),
          k.pos(400, 330),
          k.anchor("center"),
          k.color(20, 20, 35),
          k.outline(2, k.rgb(80, 80, 120)),
          "menu",
        ]);

        // Close button
        const closeBtn = k.add([
          k.rect(30, 30, { radius: 4 }),
          k.pos(630, 140),
          k.color(150, 50, 50),
          k.area(),
          "menu",
        ]);
        k.add([
          k.text("X", { size: 16 }),
          k.pos(645, 155),
          k.anchor("center"),
          k.color(255, 255, 255),
          "menu",
        ]);
        closeBtn.onClick(() => {
          menuOpen = null;
          renderAll();
        });

        // Menu title
        k.add([
          k.text(name, { size: 22 }),
          k.pos(400, 150),
          k.anchor("center"),
          k.color(255, 220, 120),
          "menu",
        ]);

        if (name === "Stats") renderStatsMenu();
        else if (name === "Bag") renderBagMenu();
        else if (name === "Map") renderMapMenu();
      }

      function renderStatsMenu() {
        const p = state.player;
        const stats = p.combatStats;
        const lines = [
          `Name: ${p.name}`,
          `Level: ${p.level}  XP: ${p.xp}/${p.xpToNext}`,
          `Type: ${p.entityType}  Class: ${p.archetype}`,
          "",
          `HP: ${stats.currentHp}/${stats.maxHp}`,
          `Mana: ${stats.currentMana}/${stats.maxMana}`,
          `Might: ${stats.might}  Defense: ${stats.defense}`,
          `Power: ${stats.power}  Agility: ${stats.agility}`,
          `Insight: ${stats.insight}  Willpower: ${stats.willpower}`,
          "",
          `Crystals: ${p.crystals}`,
          `Spells: ${p.spells.join(", ")}`,
        ];

        lines.forEach((line, i) => {
          k.add([
            k.text(line, { size: 14, width: 440 }),
            k.pos(180, 185 + i * 22),
            k.color(200, 200, 220),
            "menu",
          ]);
        });
      }

      function renderBagMenu() {
        if (state.player.inventory.length === 0) {
          k.add([
            k.text("Your bag is empty.", { size: 16 }),
            k.pos(400, 250),
            k.anchor("center"),
            k.color(150, 150, 170),
            "menu",
          ]);
          return;
        }

        state.player.inventory.forEach((inv, i) => {
          const item = content.getItem(inv.id);
          const y = 190 + i * 50;

          k.add([
            k.text(
              `${item?.name ?? inv.id} x${inv.quantity}`,
              { size: 15 }
            ),
            k.pos(200, y),
            k.color(200, 200, 220),
            "menu",
          ]);

          if (item?.description) {
            k.add([
              k.text(item.description, { size: 11 }),
              k.pos(200, y + 18),
              k.color(150, 150, 170),
              "menu",
            ]);
          }

          // Use button for consumables
          if (item?.type === "consumable") {
            const useBtn = k.add([
              k.rect(60, 28, { radius: 4 }),
              k.pos(540, y),
              k.color(60, 120, 60),
              k.area(),
              "menu",
            ]);
            k.add([
              k.text("Use", { size: 13 }),
              k.pos(570, y + 14),
              k.anchor("center"),
              k.color(255, 255, 255),
              "menu",
            ]);
            useBtn.onClick(() => {
              if (!item) return;
              // Apply effect
              if (item.effect.stat === "currentHp") {
                state.player.combatStats.currentHp = Math.min(
                  state.player.combatStats.maxHp,
                  state.player.combatStats.currentHp + item.effect.amount
                );
              } else if (item.effect.stat === "currentMana") {
                state.player.combatStats.currentMana = Math.min(
                  state.player.combatStats.maxMana,
                  state.player.combatStats.currentMana + item.effect.amount
                );
              }
              inv.quantity--;
              if (inv.quantity <= 0) {
                state.player.inventory = state.player.inventory.filter(
                  (x) => x.id !== inv.id
                );
              }
              saveGame(state);
              renderAll();
            });
          }
        });
      }

      function renderMapMenu() {
        const floor = content.getFloor(state.currentFloor);
        if (!floor) return;

        k.add([
          k.text(`Floor ${state.currentFloor + 1}: ${floor.name}`, {
            size: 16,
          }),
          k.pos(400, 185),
          k.anchor("center"),
          k.color(200, 200, 220),
          "menu",
        ]);

        floor.rooms.forEach((room, i) => {
          const discovered = state.discoveredRooms.includes(room.id);
          const isCurrent = state.currentRoomId === room.id;
          const cleared = state.clearedRooms.includes(room.id);

          const x = 180 + (i % 3) * 160;
          const y = 220 + Math.floor(i / 3) * 70;

          const bgColor = isCurrent
            ? [80, 120, 200]
            : cleared
              ? [40, 80, 40]
              : discovered
                ? [40, 40, 60]
                : [30, 30, 30];

          k.add([
            k.rect(145, 55, { radius: 4 }),
            k.pos(x, y),
            k.color(bgColor[0], bgColor[1], bgColor[2]),
            k.outline(1, k.rgb(70, 70, 90)),
            "menu",
          ]);

          k.add([
            k.text(
              discovered ? room.name : "???",
              { size: 10, width: 135 }
            ),
            k.pos(x + 5, y + 5),
            k.color(200, 200, 220),
            "menu",
          ]);

          if (discovered) {
            k.add([
              k.text(room.feature, { size: 9 }),
              k.pos(x + 5, y + 25),
              k.color(150, 150, 170),
              "menu",
            ]);
          }

          if (isCurrent) {
            k.add([
              k.text("YOU", { size: 10 }),
              k.pos(x + 5, y + 38),
              k.color(255, 255, 100),
              "menu",
            ]);
          }
        });
      }

      // Initial render
      const room = getCurrentRoom();
      if (room) discoverAdjacentRooms(room);
      renderAll();
    }
  );
}
