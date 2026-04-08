import type { GameState, PlayerState, CombatStats } from "./types";
import { ContentManager } from "./content";

// Compose stats from entityType base + archetype modifiers (inherited skill: state-composition)
function composeStats(entityTypeId: string, archetypeId: string): CombatStats {
  const entityType = ContentManager.getEntityType(entityTypeId);
  const archetype = ContentManager.getArchetype(archetypeId);

  const base: CombatStats = {
    maxHp: 100,
    currentHp: 100,
    maxMana: 50,
    currentMana: 50,
    might: 10,
    agility: 10,
    defense: 5,
    power: 8,
    insight: 8,
    willpower: 8,
  };

  // Apply entity type base stats
  if (entityType?.baseStats) {
    for (const [key, value] of Object.entries(entityType.baseStats)) {
      if (key in base && typeof value === "number") {
        (base as unknown as Record<string, number>)[key] = value;
      }
    }
  }

  // Apply archetype stat modifiers (additive)
  if (archetype?.statModifiers) {
    for (const [key, value] of Object.entries(archetype.statModifiers)) {
      if (key in base && typeof value === "number") {
        (base as unknown as Record<string, number>)[key] += value;
      }
    }
  }

  // Initialize current from max
  base.currentHp = base.maxHp;
  base.currentMana = base.maxMana;

  return base;
}

let currentState: GameState | null = null;

export function createNewGame(): GameState {
  const stats = composeStats("human", "wanderer");

  const player: PlayerState = {
    name: "Hero",
    entityTypeId: "human",
    archetypeId: "wanderer",
    stats,
    level: 1,
    xp: 0,
    xpToNext: 100,
    crystals: 0,
    inventory: [{ itemId: "potion_hp", quantity: 3 }],
    spells: ["fireball", "heal", "shield"],
    currentFloorId: "floor_1",
    currentRoomId: "room_1_start",
    discoveredRooms: ["room_1_start"],
    dungeonTick: 0,
  };

  currentState = { player, started: true };
  saveGame();
  return currentState;
}

export function getState(): GameState | null {
  return currentState;
}

export function setState(state: GameState) {
  currentState = state;
}

export function saveGame() {
  if (currentState) {
    localStorage.setItem("escape-dungeon-save", JSON.stringify(currentState));
  }
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem("escape-dungeon-save");
  if (raw) {
    try {
      currentState = JSON.parse(raw);
      return currentState;
    } catch {
      return null;
    }
  }
  return null;
}

export function hasSave(): boolean {
  return localStorage.getItem("escape-dungeon-save") !== null;
}
