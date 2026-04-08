// Core game types

export interface CombatStats {
  maxHp: number;
  currentHp: number;
  maxMana: number;
  currentMana: number;
  might: number;
  agility: number;
  defense: number;
  power: number;
  insight: number;
  willpower: number;
}

export interface EntityType {
  id: string;
  name: string;
  baseStats: Partial<CombatStats>;
  sprite?: string;
}

export interface Archetype {
  id: string;
  name: string;
  statModifiers: Partial<CombatStats>;
}

export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  damage: number;
  description: string;
  runes: string[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  effect: "heal_hp" | "heal_mana" | "damage";
  value: number;
  price: number;
}

export interface DialogueOption {
  text: string;
  next?: string;
  giveItem?: string;
  healHp?: number;
}

export interface DialogueNode {
  id: string;
  npcName: string;
  text: string;
  options: DialogueOption[];
}

export interface Room {
  id: string;
  name: string;
  description: string;
  feature: string; // combat, dialogue, treasure, rest, boss, start
  exits: { direction: string; targetRoomId: string }[];
  // Feature-specific data
  enemyId?: string;
  dialogueId?: string;
  treasureItemId?: string;
}

export interface Floor {
  id: string;
  name: string;
  rooms: Room[];
  startRoomId: string;
}

export interface PlayerState {
  name: string;
  entityTypeId: string;
  archetypeId: string;
  stats: CombatStats;
  level: number;
  xp: number;
  xpToNext: number;
  crystals: number;
  inventory: { itemId: string; quantity: number }[];
  spells: string[]; // spell IDs
  currentFloorId: string;
  currentRoomId: string;
  discoveredRooms: string[]; // room IDs
  dungeonTick: number;
}

export interface GameState {
  player: PlayerState;
  started: boolean;
}
