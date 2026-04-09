import type { GameState } from "../state";
import { getCurrentFloor, getCurrentRoom, saveGame, addItem } from "../state";
import { updateHUD, showScreen, renderResistanceBadges } from "../ui";
import { ROOM_ICONS, ROOM_COLORS } from "../data/floors";
import { ITEMS } from "../data/items";
import { enterCombat } from "./combat";
import { enterForge } from "./forge";
import { enterEvent } from "./event";
import { enterRest } from "./rest";
import {
  FLOOR_1_ENEMIES,
  FLOOR_1_ELITE,
  FLOOR_1_BOSS,
  FLOOR_2_ENEMIES,
  FLOOR_2_ELITE,
  FLOOR_2_BOSS,
} from "../data/entities";
import type { EnemyType } from "../data/entities";

function getEnemyByIds(ids: string[]): EnemyType[] {
  const allEnemies: Record<string, EnemyType> = {};
  for (const e of [...FLOOR_1_ENEMIES, FLOOR_1_ELITE, FLOOR_1_BOSS, ...FLOOR_2_ENEMIES, FLOOR_2_ELITE, FLOOR_2_BOSS]) {
    allEnemies[e.id] = e;
  }
  return ids.map((id) => allEnemies[id]).filter(Boolean);
}

export function enterRoom(state: GameState): void {
  const floor = getCurrentFloor(state);
  const room = getCurrentRoom(state);

  // Mark visited
  state.visitedRooms.add(room.id);
  state.dungeonTick++;

  // Auto-save
  saveGame(state);
  updateHUD(state);
  showScreen("room-screen");

  const container = document.getElementById("room-screen")!;
  const roomColor = ROOM_COLORS[room.type];
  const roomIcon = ROOM_ICONS[room.type];

  let html = "";

  // Room header
  html += `<div class="room-header room-${room.type}" style="border-color:${roomColor}">`;
  html += `<div class="room-icon" style="background:${roomColor}">${roomIcon}</div>`;
  html += `<div class="room-info">`;
  html += `<h2>${room.name}</h2>`;
  html += `<p>${room.description}</p>`;
  html += `</div></div>`;

  // Room body
  html += `<div class="room-body">`;

  // Room-type-specific content
  const isCleared = state.clearedRooms.has(room.id);

  if ((room.type === "combat" || room.type === "elite" || room.type === "boss") && !isCleared) {
    const enemies = getEnemyByIds(room.enemyIds ?? []);
    if (enemies.length > 0) {
      html += `<div style="text-align:center;padding:16px;background:rgba(80,20,20,0.3);border-radius:10px;border:1px solid #5a2a2a">`;
      html += `<p style="color:#ff8888;font-size:16px;margin-bottom:12px">⚔️ Enemies block your path!</p>`;
      for (const enemy of enemies) {
        html += `<div style="margin:8px 0">`;
        html += `<span style="font-size:32px">${enemy.sprite}</span>`;
        html += `<div style="font-size:15px;color:#ffaaaa">${enemy.name}</div>`;
        html += `<div style="font-size:12px;color:#aa8888">${enemy.description}</div>`;
        html += `<div style="margin-top:4px">${renderResistanceBadges(enemy.resistances)}</div>`;
        html += `</div>`;
      }
      html += `<button class="btn btn-danger" id="btn-engage">⚔️ Engage in Combat</button>`;
      html += `</div>`;
    }
  } else if (room.type === "combat" || room.type === "elite" || room.type === "boss") {
    if (room.type === "boss" && state.clearedBosses.has(floor.id)) {
      // Boss cleared — show stairs
      const nextFloor = floor.id + 1;
      if (nextFloor <= 2) {
        html += `<div style="text-align:center;padding:16px;background:rgba(50,40,20,0.3);border-radius:10px;border:1px solid #5a4a2a">`;
        html += `<p style="color:#ffd700;font-size:16px">🏆 The path to the next floor is open!</p>`;
        html += `<button class="btn btn-success" id="btn-next-floor">⬇️ Descend to Floor ${nextFloor}</button>`;
        html += `</div>`;
      } else {
        html += `<div style="text-align:center;padding:16px;background:rgba(20,50,20,0.3);border-radius:10px;border:1px solid #2a5a2a">`;
        html += `<p style="color:#ffd700;font-size:20px">🏆 You have escaped the dungeon!</p>`;
        html += `<button class="btn btn-success" id="btn-victory">🎉 Claim Victory</button>`;
        html += `</div>`;
      }
    } else {
      html += `<p style="color:#44aa44;text-align:center">✓ This area has been cleared.</p>`;
    }
  } else if (room.type === "treasure" && !isCleared) {
    html += `<div style="text-align:center;padding:16px;background:rgba(70,60,10,0.3);border-radius:10px;border:1px solid #5a4a1a">`;
    html += `<p style="color:#ffd700;font-size:16px">🎁 A treasure chest!</p>`;
    if (room.loot) {
      html += `<div style="margin:12px 0">`;
      for (const l of room.loot) {
        const item = ITEMS[l.itemId];
        if (item) {
          html += `<div style="margin:4px 0">${item.icon} ${item.name} x${l.count}</div>`;
        }
      }
      html += `</div>`;
    }
    html += `<button class="btn btn-success" id="btn-loot">🎁 Open Chest</button>`;
    html += `</div>`;
  } else if (room.type === "treasure") {
    html += `<p style="color:#8a7a9a;text-align:center">The chest is empty.</p>`;
  } else if (room.type === "forge") {
    html += `<div style="text-align:center;padding:16px;background:rgba(80,50,10,0.3);border-radius:10px;border:1px solid #6a4a1a">`;
    html += `<p style="color:#ffaa44;font-size:16px">🔨 The Ancient Forge</p>`;
    html += `<p style="color:#aa8855;font-size:13px;margin:8px 0">Combine runes to craft powerful spells. Train your affinity.</p>`;
    html += `<button class="btn btn-forge" id="btn-forge">🔨 Use the Forge</button>`;
    html += `</div>`;
  } else if (room.type === "event") {
    html += `<div style="text-align:center;padding:16px;background:rgba(20,60,30,0.3);border-radius:10px;border:1px solid #2a5a3a">`;
    html += `<p style="color:#88cc88;font-size:16px">💬 Someone is here...</p>`;
    html += `<button class="btn btn-success" id="btn-event">💬 Approach</button>`;
    html += `</div>`;
  } else if (room.type === "rest") {
    html += `<div style="text-align:center;padding:16px;background:rgba(20,40,60,0.3);border-radius:10px;border:1px solid #2a4a6a">`;
    html += `<p style="color:#88aacc;font-size:16px">🏕️ A place to rest</p>`;
    html += `<button class="btn" id="btn-rest">🏕️ Rest Here</button>`;
    html += `</div>`;
  }

  // Exits
  html += `<div class="exits-panel">`;
  html += `<h3>Exits</h3>`;
  html += `<div class="exit-buttons">`;
  for (const exit of room.exits) {
    const targetRoom = floor.rooms.find((r) => r.id === exit.targetId);
    const targetType = targetRoom?.type ?? "start";
    const icon = ROOM_ICONS[targetType];
    const visited = state.visitedRooms.has(exit.targetId);
    const label = exit.label || exit.direction;
    html += `<button class="btn exit-btn" data-target="${exit.targetId}" style="border-color:${ROOM_COLORS[targetType]}">`;
    html += `${exit.direction} ${icon} ${label}`;
    if (visited) html += ` <span style="color:#44aa44;font-size:10px">✓</span>`;
    html += `</button>`;
  }
  html += `</div></div>`;

  html += `</div>`; // room-body

  container.innerHTML = html;

  // Bind events
  const engageBtn = document.getElementById("btn-engage");
  if (engageBtn) {
    engageBtn.addEventListener("click", () => {
      const enemies = getEnemyByIds(room.enemyIds ?? []);
      if (enemies.length > 0) {
        enterCombat(state, enemies[0], () => {
          state.clearedRooms.add(room.id);
          if (room.type === "boss") {
            state.clearedBosses.add(floor.id);
          }
          // Handle multiple enemies in sequence
          if (enemies.length > 1) {
            let idx = 1;
            const fightNext = () => {
              if (idx < enemies.length) {
                enterCombat(state, enemies[idx], () => {
                  idx++;
                  fightNext();
                }, () => enterRoom(state));
              } else {
                enterRoom(state);
              }
            };
            fightNext();
          } else {
            enterRoom(state);
          }
        }, () => enterRoom(state));
      }
    });
  }

  const lootBtn = document.getElementById("btn-loot");
  if (lootBtn) {
    lootBtn.addEventListener("click", () => {
      if (room.loot) {
        for (const l of room.loot) {
          addItem(state, l.itemId, l.count);
        }
      }
      state.clearedRooms.add(room.id);
      enterRoom(state);
    });
  }

  const forgeBtn = document.getElementById("btn-forge");
  if (forgeBtn) {
    forgeBtn.addEventListener("click", () => enterForge(state, () => enterRoom(state)));
  }

  const eventBtn = document.getElementById("btn-event");
  if (eventBtn) {
    eventBtn.addEventListener("click", () => enterEvent(state, room.eventId!, () => enterRoom(state)));
  }

  const restBtn = document.getElementById("btn-rest");
  if (restBtn) {
    restBtn.addEventListener("click", () => enterRest(state, () => enterRoom(state)));
  }

  const nextFloorBtn = document.getElementById("btn-next-floor");
  if (nextFloorBtn) {
    nextFloorBtn.addEventListener("click", () => {
      state.currentFloor++;
      state.currentRoomId = `f${state.currentFloor}_start`;
      saveGame(state);
      enterRoom(state);
    });
  }

  const victoryBtn = document.getElementById("btn-victory");
  if (victoryBtn) {
    victoryBtn.addEventListener("click", () => {
      showScreen("victory-screen");
      const stats = document.getElementById("victory-stats")!;
      stats.innerHTML = `
        <p>Level: ${state.level} | Crystals: ${state.crystals}</p>
        <p>Spells Crafted: ${state.spells.filter((s) => s.crafted).length}</p>
        <p>Rooms Cleared: ${state.clearedRooms.size}</p>
        <p>Dungeon Ticks: ${state.dungeonTick}</p>
      `;
    });
  }

  // Exit buttons
  container.querySelectorAll(".exit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = (btn as HTMLElement).dataset.target!;
      state.currentRoomId = target;
      enterRoom(state);
    });
  });
}
