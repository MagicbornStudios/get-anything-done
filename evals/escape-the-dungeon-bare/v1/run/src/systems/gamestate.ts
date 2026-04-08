import type { GameState, PlayerState, CombatStats } from "../types";
import { content } from "./content";

const SAVE_KEY = "escape-the-dungeon-save";

/** Create a fresh player. */
export function createPlayer(
  name: string,
  entityTypeId: string,
  archetypeId: string
): PlayerState {
  const entityType = content.getEntityType(entityTypeId);
  const archetype = content.getArchetype(archetypeId);
  if (!entityType || !archetype) {
    throw new Error(`Unknown entity type or archetype: ${entityTypeId}, ${archetypeId}`);
  }

  const base = { ...entityType.baseStats };
  // Apply archetype modifiers
  for (const [key, val] of Object.entries(archetype.statModifiers)) {
    const k = key as keyof CombatStats;
    if (base[k] !== undefined) {
      (base[k] as number) += val as number;
    }
  }

  return {
    name,
    entityType: entityTypeId,
    archetype: archetypeId,
    level: 1,
    xp: 0,
    xpToNext: 100,
    combatStats: {
      ...base,
      currentHp: base.maxHp,
      currentMana: base.maxMana,
    },
    inventory: [{ id: "health_potion", quantity: 3 }],
    spells: ["fireball", "ice_shard"],
    preparedSpells: ["fireball", "ice_shard"],
    crystals: 0,
    equipment: {},
  };
}

/** Create initial game state. */
export function createGameState(player: PlayerState): GameState {
  const floor = content.getFloor(0);
  const startRoom = floor.rooms.find((r) => r.feature === "start");
  return {
    player,
    currentFloor: 0,
    currentRoomId: startRoom?.id ?? floor.rooms[0].id,
    discoveredRooms: [startRoom?.id ?? floor.rooms[0].id],
    clearedRooms: [],
    dungeonTick: 0,
    defeatedBosses: [],
    gameOver: false,
    victory: false,
  };
}

/** Save game to localStorage. */
export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

/** Load game from localStorage. */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

/** Check if a save exists. */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/** Delete save. */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/** Award XP and handle level-up. */
export function awardXP(state: GameState, amount: number): string[] {
  const messages: string[] = [];
  state.player.xp += amount;
  messages.push(`Gained ${amount} XP!`);

  while (state.player.xp >= state.player.xpToNext) {
    state.player.xp -= state.player.xpToNext;
    state.player.level++;
    state.player.xpToNext = Math.floor(state.player.xpToNext * 1.5);
    // Level-up stat boosts
    state.player.combatStats.maxHp += 10;
    state.player.combatStats.maxMana += 5;
    state.player.combatStats.might += 2;
    state.player.combatStats.defense += 1;
    state.player.combatStats.power += 2;
    state.player.combatStats.currentHp = state.player.combatStats.maxHp;
    state.player.combatStats.currentMana = state.player.combatStats.maxMana;
    messages.push(`Level Up! Now level ${state.player.level}!`);
  }
  return messages;
}
