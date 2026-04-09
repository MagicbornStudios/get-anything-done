import type { ContentData } from "./content";
import type { GameState, Player } from "./types";

const SAVE_KEY = "etd_save_v1";

export function createNewGame(content: ContentData): GameState {
  const player: Player = {
    name: "Varik the Lost",
    maxHp: 40,
    currentHp: 40,
    maxMana: 18,
    currentMana: 18,
    might: 6,
    defense: 3,
    agility: 4,
    insight: 5,
    willpower: 4,
    power: 5,
    xp: 0,
    level: 1,
    crystals: 12,
    narrativeStats: {
      Comprehension: 2, Constraint: 1, Construction: 1, Direction: 2, Empathy: 1,
      Equilibrium: 2, Freedom: 1, Levity: 1, Projection: 1, Survival: 2,
      Fame: 0, Effort: 1, Awareness: 2, Guile: 1, Momentum: 1
    },
    runeAffinity: { fire: 0, frost: 0, shock: 0, nature: 0, shadow: 0, blood: 0 },
    knownRunes: ["fire", "frost", "nature", "blood"],
    spellbook: content.starterSpells.map((s) => ({ ...s })),
    statuses: [],
  };
  const firstFloor = content.floors[0];
  return {
    player,
    currentFloor: 0,
    currentRoom: firstFloor.start,
    discoveredRooms: { [firstFloor.id]: [firstFloor.start] },
    clearedRooms: { [firstFloor.id]: [] },
    floorsCleared: 0,
    tick: 0,
    floorForgeUseCount: {},
    craftedSpellUsedOnFloor: {},
    view: "room",
  };
}

export function saveGame(state: GameState) {
  try {
    const { combat, ...persist } = state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(persist));
  } catch {
    // ignore
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    parsed.view = parsed.view || "room";
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}
