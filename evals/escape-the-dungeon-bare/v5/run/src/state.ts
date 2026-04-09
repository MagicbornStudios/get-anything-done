import type {
  Player,
  Scene,
  EnemyInstance,
  Enemy,
  Floor,
  Room,
  Spell,
} from "./types";
import {
  FLOORS,
  SPELLS,
  ENEMIES,
  STARTER_SPELL_IDS,
  STARTER_TRAITS,
  COMBINATIONS,
} from "./content";

const STORAGE_KEY = "escape-the-dungeon-save-v1";

export type GameState = {
  player: Player;
  scene: Scene;
  combatLog: string[];
  floors: Floor[];
  forgeSelection: string[]; // rune ids, max 2
  selectedAction: null | "spell" | "skill";
};

function newPlayer(): Player {
  return {
    name: "Seeker",
    floorIndex: 0,
    currentRoomId: FLOORS[0].startRoomId,
    combatStats: {
      maxHp: 32,
      currentHp: 32,
      maxMana: 18,
      currentMana: 18,
      might: 4,
      agility: 3,
      insight: 3,
      willpower: 3,
      defense: 2,
      power: 3,
    },
    narrativeStats: { ...STARTER_TRAITS },
    runeAffinity: { F: 1, I: 0, P: 0, B: 0, S: 0 },
    crystals: 2,
    xp: 0,
    level: 1,
    knownSpellIds: [...STARTER_SPELL_IDS],
    preparedSpellIds: [...STARTER_SPELL_IDS],
    skillIds: ["slash"],
    discoveredRoomIds: [FLOORS[0].startRoomId],
    clearedRoomIds: [],
    defeatedBossIds: [],
    tick: 0,
    activeEffects: [],
  };
}

export function createInitialState(): GameState {
  return {
    player: newPlayer(),
    scene: { kind: "title" },
    combatLog: [],
    floors: FLOORS,
    forgeSelection: [],
    selectedAction: null,
  };
}

export function saveState(state: GameState): void {
  try {
    const data = { player: state.player, scene: state.scene };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.player) return null;
    return {
      player: data.player,
      scene: data.scene ?? { kind: "room", roomId: data.player.currentRoomId },
      combatLog: [],
      floors: FLOORS,
      forgeSelection: [],
      selectedAction: null,
    };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ---------- lookups ----------

export function currentFloor(state: GameState): Floor {
  return state.floors[state.player.floorIndex];
}

export function getRoom(state: GameState, id: string): Room | undefined {
  for (const f of state.floors) {
    const r = f.rooms.find(r => r.id === id);
    if (r) return r;
  }
  return undefined;
}

export function currentRoom(state: GameState): Room {
  const r = getRoom(state, state.player.currentRoomId);
  if (!r) throw new Error("current room missing: " + state.player.currentRoomId);
  return r;
}

export function findSpell(id: string): Spell | undefined {
  return SPELLS.find(s => s.id === id);
}

export function findEnemy(id: string): Enemy | undefined {
  return ENEMIES.find(e => e.id === id);
}

export function instantiateEnemies(ids: string[]): EnemyInstance[] {
  return ids.map(id => {
    const e = findEnemy(id);
    if (!e) throw new Error("unknown enemy: " + id);
    return {
      ...e,
      combatStats: { ...e.combatStats, currentHp: e.combatStats.maxHp },
      resistances: { ...e.resistances },
      activeEffects: [],
    };
  });
}

// ---------- forge ----------

export function runeKey(runeIds: string[]): string {
  return [...runeIds].sort().join("");
}

export function previewForge(runeIds: string[]): Spell | null {
  if (runeIds.length === 0) return null;
  const id = COMBINATIONS[runeKey(runeIds)];
  if (!id) return null;
  return findSpell(id) ?? null;
}

// ---------- save hook ----------

export function autosave(state: GameState): void {
  saveState(state);
}
