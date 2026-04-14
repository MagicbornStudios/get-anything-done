// ---- Content Pack Types ----

export interface CombatStats {
  maxHp: number;
  maxMana: number;
  might: number;
  agility: number;
  defense: number;
  power: number;
  insight: number;
  willpower: number;
  currentHp?: number;
  currentMana?: number;
}

export interface EntityType {
  id: string;
  name: string;
  baseStats: CombatStats;
}

export interface Archetype {
  id: string;
  name: string;
  statModifiers: Partial<CombatStats>;
}

export interface EntitiesData {
  entityTypes: EntityType[];
  archetypes: Archetype[];
  occupations: string[];
}

export interface RoomExit {
  [direction: string]: string;
}

export interface RoomData {
  id: string;
  name: string;
  description: string;
  feature: RoomFeature;
  exits: RoomExit;
  enemyId?: string;
  enemyArchetype?: string;
  npcId?: string;
  loot?: { crystals: number; itemId?: string };
  bossName?: string;
  bossStats?: CombatStats;
}

export type RoomFeature =
  | "start"
  | "combat"
  | "dialogue"
  | "treasure"
  | "rest"
  | "forge"
  | "boss";

export interface FloorData {
  id: string;
  name: string;
  rooms: RoomData[];
}

export interface FloorsData {
  floors: FloorData[];
}

export interface ItemEffect {
  stat: string;
  amount: number;
}

export interface ItemData {
  id: string;
  name: string;
  description: string;
  type: "consumable" | "equipment";
  slot?: string;
  effect: ItemEffect;
}

export interface ItemsData {
  items: ItemData[];
}

export interface SpellData {
  id: string;
  name: string;
  description: string;
  runes: string[];
  manaCost: number;
  damage?: number;
  healing?: number;
  defenseBoost?: number;
  category: string;
  element: string;
}

export interface SpellsData {
  spells: SpellData[];
}

export interface DialogueOption {
  text: string;
  response: string;
  effect: { type: string; itemId?: string; spellId?: string } | null;
}

export interface DialogueData {
  npcName: string;
  greeting: string;
  options: DialogueOption[];
}

export interface DialoguesData {
  dialogues: Record<string, DialogueData>;
}

// ---- Game State ----

export interface InventoryItem {
  id: string;
  quantity: number;
}

export interface PlayerState {
  name: string;
  entityType: string;
  archetype: string;
  level: number;
  xp: number;
  xpToNext: number;
  combatStats: CombatStats & { currentHp: number; currentMana: number };
  inventory: InventoryItem[];
  spells: string[];
  preparedSpells: string[];
  crystals: number;
  equipment: Record<string, string>;
}

export interface GameState {
  player: PlayerState;
  currentFloor: number;
  currentRoomId: string;
  discoveredRooms: string[];
  clearedRooms: string[];
  dungeonTick: number;
  defeatedBosses: string[];
  gameOver: boolean;
  victory: boolean;
}
