import type { GameState, PlayerState, InventoryItem } from "../types";

const SAVE_KEY = "escape_dungeon_save";

function createNewPlayer(name: string): PlayerState {
  return {
    name,
    level: 1,
    xp: 0,
    xpToNext: 100,
    combatStats: {
      currentHp: 100,
      maxHp: 100,
      currentMana: 60,
      maxMana: 60,
      might: 10,
      agility: 10,
      defense: 10,
      power: 10,
      insight: 10,
      willpower: 10,
    },
    crystals: 0,
    inventory: [{ id: "health_potion", quantity: 2 }],
    spells: ["fireball", "heal", "ice_shard"],
    currentFloor: 0,
    currentRoomId: "f1_start",
    discoveredRooms: ["f1_start"],
    defeatedEnemies: [],
    dungeonTick: 0,
  };
}

let currentState: GameState = {
  player: createNewPlayer("Hero"),
  gameStarted: false,
};

export function getState(): GameState {
  return currentState;
}

export function getPlayer(): PlayerState {
  return currentState.player;
}

export function startNewGame(name: string): void {
  currentState = {
    player: createNewPlayer(name),
    gameStarted: true,
  };
  saveGame();
}

export function saveGame(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(currentState));
  } catch {
    // localStorage not available
  }
}

export function loadGame(): boolean {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      currentState = JSON.parse(saved);
      currentState.gameStarted = true;
      return true;
    }
  } catch {
    // corrupt save or not available
  }
  return false;
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function addItem(itemId: string, quantity: number = 1): void {
  const existing = currentState.player.inventory.find((i) => i.id === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    currentState.player.inventory.push({ id: itemId, quantity });
  }
  saveGame();
}

export function removeItem(itemId: string, quantity: number = 1): boolean {
  const existing = currentState.player.inventory.find((i) => i.id === itemId);
  if (!existing || existing.quantity < quantity) return false;
  existing.quantity -= quantity;
  if (existing.quantity <= 0) {
    currentState.player.inventory = currentState.player.inventory.filter(
      (i) => i.id !== itemId
    );
  }
  saveGame();
  return true;
}

export function getItemCount(itemId: string): number {
  const item = currentState.player.inventory.find((i) => i.id === itemId);
  return item ? item.quantity : 0;
}

export function discoverRoom(roomId: string): void {
  if (!currentState.player.discoveredRooms.includes(roomId)) {
    currentState.player.discoveredRooms.push(roomId);
  }
}

export function gainXp(amount: number): boolean {
  const p = currentState.player;
  p.xp += amount;
  if (p.xp >= p.xpToNext) {
    p.level++;
    p.xp -= p.xpToNext;
    p.xpToNext = Math.floor(p.xpToNext * 1.5);
    p.combatStats.maxHp += 10;
    p.combatStats.maxMana += 5;
    p.combatStats.currentHp = p.combatStats.maxHp;
    p.combatStats.currentMana = p.combatStats.maxMana;
    p.combatStats.might += 2;
    p.combatStats.defense += 1;
    p.combatStats.power += 2;
    p.combatStats.agility += 1;
    saveGame();
    return true; // leveled up
  }
  saveGame();
  return false;
}
