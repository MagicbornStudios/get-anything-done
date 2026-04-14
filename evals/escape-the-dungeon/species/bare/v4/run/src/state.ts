import { createPlayerStats, type CombatStats } from "./data/entities";
import type { PlayerSpell } from "./data/spells";
import { STARTER_SPELLS } from "./data/spells";
import { FLOORS } from "./data/floors";

export interface InventoryItem {
  itemId: string;
  count: number;
}

export interface StatusEffect {
  name: string;
  type: "dot" | "buff_might" | "buff_defense" | "debuff_defense" | "debuff_agility";
  element?: string;
  power: number;
  turnsRemaining: number;
}

export interface GameState {
  playerName: string;
  stats: CombatStats;
  level: number;
  xp: number;
  xpToLevel: number;
  crystals: number;
  currentFloor: number;
  currentRoomId: string;
  dungeonTick: number;
  inventory: InventoryItem[];
  spells: PlayerSpell[];
  runeAffinity: Record<string, number>;  // rune_id -> affinity level
  visitedRooms: Set<string>;
  clearedRooms: Set<string>;  // combat rooms cleared
  clearedBosses: Set<number>; // floor IDs of defeated bosses
  statusEffects: StatusEffect[];
  narrativeStats: Record<string, number>;
  // combat state
  inCombat: boolean;
  combatTurn: number;
  enemyStatusEffects: StatusEffect[];
}

const SAVE_KEY = "escape-dungeon-save";

export function createNewGame(): GameState {
  return {
    playerName: "Adventurer",
    stats: createPlayerStats(),
    level: 1,
    xp: 0,
    xpToLevel: 50,
    crystals: 0,
    currentFloor: 1,
    currentRoomId: "f1_start",
    dungeonTick: 0,
    inventory: [
      { itemId: "health_potion", count: 2 },
      { itemId: "mana_potion", count: 1 },
    ],
    spells: [...STARTER_SPELLS],
    runeAffinity: {},
    visitedRooms: new Set(["f1_start"]),
    clearedRooms: new Set(),
    clearedBosses: new Set(),
    statusEffects: [],
    narrativeStats: {
      Comprehension: 5,
      Survival: 5,
      Awareness: 3,
      Guile: 2,
      Momentum: 0,
    },
    inCombat: false,
    combatTurn: 0,
    enemyStatusEffects: [],
  };
}

// Serializable version for localStorage
interface SaveData {
  playerName: string;
  stats: CombatStats;
  level: number;
  xp: number;
  xpToLevel: number;
  crystals: number;
  currentFloor: number;
  currentRoomId: string;
  dungeonTick: number;
  inventory: InventoryItem[];
  spells: PlayerSpell[];
  runeAffinity: Record<string, number>;
  visitedRooms: string[];
  clearedRooms: string[];
  clearedBosses: number[];
  narrativeStats: Record<string, number>;
}

export function saveGame(state: GameState): void {
  const data: SaveData = {
    playerName: state.playerName,
    stats: state.stats,
    level: state.level,
    xp: state.xp,
    xpToLevel: state.xpToLevel,
    crystals: state.crystals,
    currentFloor: state.currentFloor,
    currentRoomId: state.currentRoomId,
    dungeonTick: state.dungeonTick,
    inventory: state.inventory,
    spells: state.spells,
    runeAffinity: state.runeAffinity,
    visitedRooms: Array.from(state.visitedRooms),
    clearedRooms: Array.from(state.clearedRooms),
    clearedBosses: Array.from(state.clearedBosses),
    narrativeStats: state.narrativeStats,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const data: SaveData = JSON.parse(raw);
    return {
      ...data,
      visitedRooms: new Set(data.visitedRooms),
      clearedRooms: new Set(data.clearedRooms),
      clearedBosses: new Set(data.clearedBosses),
      statusEffects: [],
      inCombat: false,
      combatTurn: 0,
      enemyStatusEffects: [],
    };
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

// Level up logic
export function checkLevelUp(state: GameState): string[] {
  const messages: string[] = [];
  while (state.xp >= state.xpToLevel) {
    state.xp -= state.xpToLevel;
    state.level++;
    state.xpToLevel = Math.floor(state.xpToLevel * 1.4);
    // Stat gains
    state.stats.maxHp += 10;
    state.stats.currentHp = Math.min(state.stats.currentHp + 10, state.stats.maxHp);
    state.stats.maxMana += 5;
    state.stats.currentMana = Math.min(state.stats.currentMana + 5, state.stats.maxMana);
    state.stats.might += 2;
    state.stats.defense += 1;
    state.stats.power += 2;
    state.stats.agility += 1;
    messages.push(`Level Up! You are now level ${state.level}. HP +10, Mana +5, Might +2, Power +2`);
  }
  return messages;
}

export function getCurrentFloor(state: GameState) {
  return FLOORS.find((f) => f.id === state.currentFloor) ?? FLOORS[0];
}

export function getCurrentRoom(state: GameState) {
  const floor = getCurrentFloor(state);
  return floor.rooms.find((r) => r.id === state.currentRoomId) ?? floor.rooms[0];
}

export function addItem(state: GameState, itemId: string, count: number = 1): void {
  const existing = state.inventory.find((i) => i.itemId === itemId);
  if (existing) {
    existing.count += count;
  } else {
    state.inventory.push({ itemId, count });
  }
}

export function removeItem(state: GameState, itemId: string, count: number = 1): boolean {
  const existing = state.inventory.find((i) => i.itemId === itemId);
  if (!existing || existing.count < count) return false;
  existing.count -= count;
  if (existing.count <= 0) {
    state.inventory = state.inventory.filter((i) => i.itemId !== itemId);
  }
  return true;
}
