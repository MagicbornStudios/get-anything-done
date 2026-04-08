// Game state manager - single source of truth for all game state
import type { PlayerState, Floor, Enemy, GameState } from "../types";
import { createFloor, RUNES, ITEMS, SPELLS } from "../data/content";

const SAVE_KEY = "escape_the_dungeon_save";

function createDefaultPlayer(): PlayerState {
  return {
    name: "Adventurer",
    level: 1,
    xp: 0,
    xpToNext: 50,
    crystals: 0,
    stats: {
      currentHp: 80,
      maxHp: 80,
      currentMana: 40,
      maxMana: 40,
      might: 10,
      agility: 8,
      defense: 5,
      power: 7,
      insight: 5,
      willpower: 4,
    },
    runes: ["fire", "ice"], // Start with 2 runes so player can craft immediately
    spells: [],
    items: ["health_potion"],
    currentFloor: 1,
    currentRoomId: "f1_entrance",
    tick: 0,
    discoveredRooms: ["f1_entrance", "f1_boss"],
  };
}

let gameState: GameState = {
  player: createDefaultPlayer(),
  floors: [createFloor(1)],
  inCombat: false,
  currentEnemy: null,
};

export function getState(): GameState {
  return gameState;
}

export function getPlayer(): PlayerState {
  return gameState.player;
}

export function getCurrentFloor(): Floor {
  const floorIndex = gameState.player.currentFloor - 1;
  if (!gameState.floors[floorIndex]) {
    gameState.floors[floorIndex] = createFloor(gameState.player.currentFloor);
  }
  return gameState.floors[floorIndex];
}

export function getCurrentRoom() {
  const floor = getCurrentFloor();
  return floor.rooms[gameState.player.currentRoomId];
}

export function discoverAdjacentRooms(roomId: string) {
  const floor = getCurrentFloor();
  const room = floor.rooms[roomId];
  if (!room) return;

  for (const targetId of Object.values(room.exits)) {
    const target = floor.rooms[targetId];
    if (target && !target.discovered) {
      target.discovered = true;
      if (!gameState.player.discoveredRooms.includes(targetId)) {
        gameState.player.discoveredRooms.push(targetId);
      }
    }
  }
}

export function moveToRoom(roomId: string) {
  const floor = getCurrentFloor();
  const room = floor.rooms[roomId];
  if (!room) return;

  gameState.player.currentRoomId = roomId;
  gameState.player.tick++;
  room.visited = true;
  room.discovered = true;

  if (!gameState.player.discoveredRooms.includes(roomId)) {
    gameState.player.discoveredRooms.push(roomId);
  }

  discoverAdjacentRooms(roomId);
}

export function addRune(runeId: string) {
  if (RUNES[runeId] && !gameState.player.runes.includes(runeId)) {
    gameState.player.runes.push(runeId);
  }
}

export function addSpell(spellId: string) {
  if (SPELLS[spellId] && !gameState.player.spells.includes(spellId)) {
    gameState.player.spells.push(spellId);
  }
}

export function addItem(itemId: string) {
  if (ITEMS[itemId]) {
    gameState.player.items.push(itemId);
  }
}

export function removeItem(itemId: string) {
  const idx = gameState.player.items.indexOf(itemId);
  if (idx >= 0) {
    gameState.player.items.splice(idx, 1);
  }
}

export function addXp(amount: number) {
  gameState.player.xp += amount;
  while (gameState.player.xp >= gameState.player.xpToNext) {
    gameState.player.xp -= gameState.player.xpToNext;
    gameState.player.level++;
    gameState.player.xpToNext = Math.floor(gameState.player.xpToNext * 1.5);
    // Level up stat boosts
    gameState.player.stats.maxHp += 10;
    gameState.player.stats.currentHp = gameState.player.stats.maxHp;
    gameState.player.stats.maxMana += 5;
    gameState.player.stats.currentMana = gameState.player.stats.maxMana;
    gameState.player.stats.might += 2;
    gameState.player.stats.defense += 1;
    gameState.player.stats.power += 2;
    gameState.player.stats.agility += 1;
  }
}

export function addCrystals(amount: number) {
  gameState.player.crystals += amount;
}

export function healPlayer(hpAmount: number, manaAmount: number = 0) {
  const s = gameState.player.stats;
  s.currentHp = Math.min(s.maxHp, s.currentHp + hpAmount);
  s.currentMana = Math.min(s.maxMana, s.currentMana + manaAmount);
}

export function setCombatEnemy(enemy: Enemy | null) {
  gameState.inCombat = enemy !== null;
  gameState.currentEnemy = enemy ? { ...enemy, stats: { ...enemy.stats } } : null;
}

export function markRoomCleared(roomId: string) {
  const floor = getCurrentFloor();
  const room = floor.rooms[roomId];
  if (room) room.cleared = true;
}

export function newGame() {
  gameState = {
    player: createDefaultPlayer(),
    floors: [createFloor(1)],
    inCombat: false,
    currentEnemy: null,
  };
  // Discover adjacent rooms from entrance
  discoverAdjacentRooms(gameState.player.currentRoomId);
  const floor = getCurrentFloor();
  const entrance = floor.rooms[gameState.player.currentRoomId];
  if (entrance) {
    entrance.visited = true;
    entrance.cleared = true;
  }
  saveGame();
}

export function saveGame() {
  try {
    const saveData = JSON.stringify(gameState);
    localStorage.setItem(SAVE_KEY, saveData);
  } catch {
    // silently fail
  }
}

export function loadGame(): boolean {
  try {
    const saveData = localStorage.getItem(SAVE_KEY);
    if (saveData) {
      gameState = JSON.parse(saveData);
      return true;
    }
  } catch {
    // silently fail
  }
  return false;
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function nextFloor() {
  const nextFloorNum = gameState.player.currentFloor + 1;
  if (!gameState.floors[nextFloorNum - 1]) {
    gameState.floors[nextFloorNum - 1] = createFloor(nextFloorNum);
  }
  gameState.player.currentFloor = nextFloorNum;
  const floor = gameState.floors[nextFloorNum - 1];
  gameState.player.currentRoomId = floor.startRoomId;
  gameState.player.discoveredRooms.push(floor.startRoomId);
  moveToRoom(floor.startRoomId);
  const entrance = floor.rooms[floor.startRoomId];
  if (entrance) {
    entrance.cleared = true;
  }
}
