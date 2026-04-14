import type { GameState, Spell } from "./types";
import { STARTER_SPELLS } from "./content/runes";

const SAVE_KEY = "etd-save-v1";

export function newGame(name: string = "Wanderer"): GameState {
  const starter: Spell[] = STARTER_SPELLS.map((s) => ({ ...s }));
  return {
    scene: "room",
    playerName: name,
    floor: 1,
    currentRoomId: "f1_entry",
    tick: 0,
    crystals: 10,
    xp: 0,
    level: 1,
    combatStats: {
      maxHp: 30, currentHp: 30,
      maxMana: 16, currentMana: 16,
      might: 4, agility: 4, insight: 5, defense: 2, power: 5,
    },
    skillStats: { Slashing: 1, Bludgeoning: 0, Ranged: 0, Magic: 2 },
    narrativeStats: { Comprehension: 1, Survival: 2, Awareness: 1, Freedom: 1 },
    runeAffinity: { rune_pyr: 0, rune_kry: 0, rune_zep: 0, rune_tox: 0, rune_umb: 0 },
    knownRunes: ["rune_pyr", "rune_kry", "rune_zep", "rune_umb"], // Tox discovered via scholar event
    spells: starter,
    equippedSpells: starter.map((s) => s.id),
    discoveredRooms: { f1_entry: true, f1_guard_hall: true, f1_forge: true },
    clearedRooms: {},
    log: ["Welcome to the dungeon. You awake at the Rusted Gate."],
  };
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Save failed", e);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch (e) {
    console.warn("Load failed", e);
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function addLog(state: GameState, line: string): void {
  state.log.push(line);
  if (state.log.length > 100) state.log.shift();
}
