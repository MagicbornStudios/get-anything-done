// Core game types

export interface CombatStats {
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  might: number;
  agility: number;
  defense: number;
  power: number;
  insight: number;
  willpower: number;
}

export interface Rune {
  id: string;
  name: string;
  element: string;
  icon: string; // emoji for visual
  color: string;
  description: string;
}

export interface Spell {
  id: string;
  name: string;
  manaCost: number;
  damage: number;
  element: string;
  description: string;
  runeRecipe: [string, string]; // two rune ids
  icon: string;
  color: string;
}

export interface Item {
  id: string;
  name: string;
  type: "potion" | "scroll" | "key";
  effect: string;
  value: number;
  icon: string;
  description: string;
}

export interface Enemy {
  id: string;
  name: string;
  stats: CombatStats;
  xpReward: number;
  crystalReward: number;
  spriteColor: string;
  description: string;
}

export interface NPC {
  id: string;
  name: string;
  portraitColor: string;
  dialogue: DialogueNode[];
}

export interface DialogueNode {
  text: string;
  choices?: DialogueChoice[];
}

export interface DialogueChoice {
  text: string;
  nextIndex?: number;
  effect?: DialogueEffect;
}

export interface DialogueEffect {
  type: "give_item" | "give_rune" | "heal" | "give_xp" | "teach_spell";
  itemId?: string;
  runeId?: string;
  amount?: number;
}

export type RoomType = "combat" | "dialogue" | "treasure" | "rest" | "forge" | "boss";

export interface Room {
  id: string;
  name: string;
  description: string;
  type: RoomType;
  exits: Record<string, string>; // direction -> room id
  discovered: boolean;
  visited: boolean;
  cleared: boolean;
  enemyId?: string;
  npcId?: string;
  loot?: string[]; // item ids
}

export interface Floor {
  id: number;
  rooms: Record<string, Room>;
  startRoomId: string;
}

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  crystals: number;
  stats: CombatStats;
  runes: string[]; // rune ids
  spells: string[]; // spell ids
  items: string[]; // item ids
  currentFloor: number;
  currentRoomId: string;
  tick: number;
  discoveredRooms: string[];
}

export interface GameState {
  player: PlayerState;
  floors: Floor[];
  inCombat: boolean;
  currentEnemy: Enemy | null;
}
