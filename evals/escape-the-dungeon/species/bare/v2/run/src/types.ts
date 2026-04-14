// ---- Content Pack Types ----

export interface EntityType {
  id: string;
  name: string;
  spriteColor: [number, number, number];
}

export interface Archetype {
  id: string;
  name: string;
  baseStats: CombatStats;
}

export interface EnemyDef {
  id: string;
  name: string;
  entityType: string;
  archetype: string;
  level: number;
  stats: CombatStats;
  xpReward: number;
  crystalReward: number;
}

export interface CombatStats {
  maxHp: number;
  maxMana: number;
  might: number;
  agility: number;
  defense: number;
  power: number;
  insight?: number;
  willpower?: number;
}

export interface RoomDef {
  id: string;
  name: string;
  type: RoomType;
  description: string;
  exits: Record<string, string>;
  enemyId?: string;
  npcId?: string;
  loot?: { crystals: number; item?: string };
}

export type RoomType = "start" | "combat" | "dialogue" | "treasure" | "rest" | "boss" | "forge";

export interface FloorDef {
  id: string;
  name: string;
  level: number;
  rooms: RoomDef[];
}

export interface SpellDef {
  id: string;
  name: string;
  runes: string[];
  manaCost: number;
  damage: number;
  type: string;
  description: string;
  effect?: string;
}

export interface ItemDef {
  id: string;
  name: string;
  type: "consumable" | "equipment" | "key_item";
  effect?: string;
  value?: number;
  slot?: string;
  statBonus?: Record<string, number>;
  description: string;
  cost?: number;
}

export interface DialogueOption {
  text: string;
  response: string;
  effect: { type: string; itemId?: string; cost?: number } | null;
}

export interface NpcDef {
  name: string;
  entityType: string;
  greeting: string;
  dialogueOptions: DialogueOption[];
}

// ---- Runtime Game State ----

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  combatStats: {
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
  };
  crystals: number;
  inventory: InventoryItem[];
  spells: string[]; // spell ids
  currentFloor: number;
  currentRoomId: string;
  discoveredRooms: string[];
  defeatedEnemies: string[]; // room ids where enemy was defeated
  dungeonTick: number;
}

export interface InventoryItem {
  id: string;
  quantity: number;
}

export interface EnemyState {
  def: EnemyDef;
  currentHp: number;
  currentMana: number;
}

export interface GameState {
  player: PlayerState;
  gameStarted: boolean;
}
