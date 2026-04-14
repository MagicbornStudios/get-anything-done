// Game state management
// Skill: state-composition (inherited) — NaN prevention, proper HP init

import type { PlayerState, GameState, CombatStats, BuffEffect } from "./types";
import { getContent } from "./content";

const SAVE_KEY = "escape-dungeon-save";

export function createNewPlayer(archetypeId: string): PlayerState {
  const content = getContent();
  const archetype = content.archetypes.find((a) => a.id === archetypeId);

  // Base player stats
  const baseStats: Record<string, number> = {
    maxHp: 80,
    maxMana: 40,
    might: 10,
    agility: 10,
    defense: 6,
    power: 8,
    insight: 6,
    willpower: 5,
  };

  // Apply archetype modifiers (NaN prevention: default missing keys to 0)
  if (archetype) {
    for (const [key, mod] of Object.entries(archetype.statModifiers)) {
      baseStats[key] = (baseStats[key] || 0) + (mod as number);
    }
  }

  const combatStats: CombatStats = {
    maxHp: baseStats.maxHp,
    maxMana: baseStats.maxMana,
    currentHp: baseStats.maxHp,  // Initialize current = max
    currentMana: baseStats.maxMana,
    might: baseStats.might,
    agility: baseStats.agility,
    defense: baseStats.defense,
    power: baseStats.power,
    insight: baseStats.insight,
    willpower: baseStats.willpower,
  };

  return {
    name: "Hero",
    archetypeId,
    combatStats,
    runes: [...content.starterRunes],
    craftedSpells: [...content.starterSpells],
    equippedSpells: [...content.starterSpells],
    items: { health_potion: 2, mana_potion: 1 },
    crystals: 10,
    xp: 0,
    level: 1,
    currentFloorId: "floor1",
    currentRoomId: "r1",
    discoveredRooms: ["r1"],
    collectedTreasure: [],
    dungeonTick: 0,
    buffs: [],
  };
}

export function createGameState(player: PlayerState): GameState {
  return { player, contentLoaded: true };
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // silently fail
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

// XP and leveling
export function addXP(player: PlayerState, amount: number): boolean {
  player.xp += amount;
  const xpNeeded = player.level * 50;
  if (player.xp >= xpNeeded) {
    player.xp -= xpNeeded;
    player.level += 1;
    // Stat boosts on level up
    player.combatStats.maxHp += 5;
    player.combatStats.maxMana += 3;
    player.combatStats.might += 1;
    player.combatStats.power += 1;
    player.combatStats.defense += 1;
    player.combatStats.currentHp = player.combatStats.maxHp;
    player.combatStats.currentMana = player.combatStats.maxMana;
    return true; // leveled up
  }
  return false;
}

// Buff management
export function tickBuffs(player: PlayerState): void {
  player.buffs = player.buffs.filter((b) => {
    b.turnsRemaining -= 1;
    return b.turnsRemaining > 0;
  });
}

export function getBuffedStat(player: PlayerState, stat: string): number {
  const base = (player.combatStats as unknown as Record<string, number>)[stat] || 0;
  const buffBonus = player.buffs
    .filter((b: BuffEffect) => b.stat === stat)
    .reduce((sum: number, b: BuffEffect) => sum + b.amount, 0);
  return base + buffBonus;
}
