import type { GameState, PlayerState, Floor, Spell } from "../types/game";
import { FLOORS } from "../data/floors";

const STARTER_SPELL: Spell = {
  id: "spell-spark",
  name: "Spark",
  runes: [],
  manaCost: 3,
  damage: 8,
  damageType: "arcane",
  description: "A weak arcane spark. Not enough for serious threats.",
  crafted: false,
};

function createNewPlayer(): PlayerState {
  return {
    name: "Adventurer",
    level: 1,
    xp: 0,
    xpToNext: 50,
    combatStats: {
      currentHp: 40,
      maxHp: 40,
      currentMana: 20,
      maxMana: 20,
      might: 8,
      agility: 6,
      defense: 4,
      power: 5,
      insight: 5,
      willpower: 4,
    },
    narrativeStats: {
      comprehension: 3, constraint: 2, construction: 2, direction: 3,
      empathy: 2, equilibrium: 2, freedom: 3, levity: 1,
      projection: 2, survival: 3, fame: 0, effort: 2,
      awareness: 3, guile: 1, momentum: 2,
    },
    skillStats: {
      slashing: 1, bludgeoning: 1, ranged: 0, magic: 1,
    },
    runeAffinity: {},
    spells: [STARTER_SPELL],
    items: [
      { id: "potion-small", name: "Small Potion", type: "potion", description: "Restores 15 HP", effect: "heal", value: 15 },
    ],
    crystals: 5,
    currentFloor: 1,
    currentRoom: "f1-start",
    discoveredRooms: ["f1-start"],
    clearedRooms: [],
    tick: 0,
  };
}

let gameState: GameState | null = null;

export function newGame(): GameState {
  const floors = JSON.parse(JSON.stringify(FLOORS)) as Floor[];
  gameState = {
    player: createNewPlayer(),
    floors,
    gameOver: false,
    victory: false,
  };
  return gameState;
}

export function getState(): GameState {
  if (!gameState) throw new Error("Game not initialized");
  return gameState;
}

export function setState(state: GameState): void {
  gameState = state;
}

export function getCurrentFloor(): Floor {
  const state = getState();
  const floor = state.floors.find(f => f.id === state.player.currentFloor);
  if (!floor) throw new Error(`Floor ${state.player.currentFloor} not found`);
  return floor;
}

export function getCurrentRoom() {
  const floor = getCurrentFloor();
  const room = floor.rooms.find(r => r.id === getState().player.currentRoom);
  if (!room) throw new Error(`Room ${getState().player.currentRoom} not found`);
  return room;
}

export function discoverRoom(roomId: string) {
  const state = getState();
  if (!state.player.discoveredRooms.includes(roomId)) {
    state.player.discoveredRooms.push(roomId);
  }
}

export function advanceTick() {
  getState().player.tick++;
}

export function addXp(amount: number): boolean {
  const p = getState().player;
  p.xp += amount;
  if (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = Math.floor(p.xpToNext * 1.5);
    p.combatStats.maxHp += 5;
    p.combatStats.currentHp = Math.min(p.combatStats.currentHp + 5, p.combatStats.maxHp);
    p.combatStats.maxMana += 3;
    p.combatStats.currentMana = Math.min(p.combatStats.currentMana + 3, p.combatStats.maxMana);
    p.combatStats.might += 1;
    p.combatStats.power += 1;
    p.combatStats.defense += 1;
    return true; // leveled up
  }
  return false;
}

export function addCrystals(amount: number) {
  getState().player.crystals += amount;
}

export function saveGame() {
  try {
    localStorage.setItem("escape-dungeon-save", JSON.stringify(getState()));
  } catch (e) {
    console.warn("Failed to save:", e);
  }
}

export function loadGame(): GameState | null {
  try {
    const data = localStorage.getItem("escape-dungeon-save");
    if (!data) return null;
    const state = JSON.parse(data) as GameState;
    gameState = state;
    return state;
  } catch (e) {
    console.warn("Failed to load:", e);
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem("escape-dungeon-save") !== null;
}

export function deleteSave(): void {
  localStorage.removeItem("escape-dungeon-save");
}
