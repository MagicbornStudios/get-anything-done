// === Room and Dungeon Types ===

export interface RoomExit {
  direction: string;
  targetRoomId: string;
  label?: string;
}

export interface Room {
  roomId: string;
  name: string;
  description: string;
  feature: RoomFeature;
  exits: RoomExit[];
  entities?: string[]; // entity IDs present in room
  treasureChestRef?: string;
  lootTableId?: string;
}

export type RoomFeature =
  | "corridor"
  | "start"
  | "exit"
  | "stairs_up"
  | "stairs_down"
  | "escape_gate"
  | "training"
  | "dialogue"
  | "rest"
  | "treasure"
  | "rune_forge"
  | "combat";

export interface DungeonLevel {
  depth: number;
  rooms: Room[];
  bossEntityId?: string;
  mapLayout?: Record<string, { x: number; y: number }>;
}

export interface Dungeon {
  dungeonId: string;
  name: string;
  levels: DungeonLevel[];
}

// === Entity Types ===

export interface CombatStats {
  might: number;
  agility: number;
  insight: number;
  willpower: number;
  defense: number;
  power: number;
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
}

export interface EntityDefinition {
  entityId: string;
  name: string;
  entityTypeId: string;
  archetypeId?: string;
  occupationId: string;
  partyRoleId?: string;
  combatStats: CombatStats;
  level: number;
  spriteUrl?: string;
  xpReward?: number;
  crystalReward?: number;
  dialogueLines?: string[];
}

// === Spell and Rune Types ===

export interface RuneDefinition {
  runeId: string;
  name: string;
  symbol: string;
  basePower: number;
  type: string; // element type
  color: string;
  description: string;
}

export interface SpellDefinition {
  spellId: string;
  name: string;
  runeCombo: string[];
  manaCost: number;
  power: number;
  categoryId: SpellCategory;
  description: string;
  effects?: SpellEffect[];
  rarityId?: string;
  isAuthored?: boolean;
}

export type SpellCategory =
  | "combat"
  | "conversation"
  | "transportation"
  | "exploration"
  | "crafting"
  | "detection";

export interface SpellEffect {
  effectId: string;
  kind: "damage" | "heal" | "status" | "buff" | "debuff";
  value: number;
  target: "enemy" | "self";
  statusId?: string;
  duration?: number;
}

// === Player State ===

export interface PlayerState {
  name: string;
  entityTypeId: string;
  occupationId: string;
  partyRoleId: string;
  combatStats: CombatStats;
  level: number;
  xp: number;
  xpToNext: number;
  fame: number;
  manaCrystals: number;
  inventory: InventoryItem[];
  spellPool: SpellDefinition[];
  preparedSlots: (SpellDefinition | null)[];
  runeAffinities: Record<string, number>;
  equippedTitleId: string | null;
  discoveredRooms: Record<number, string[]>; // depth -> roomIds
  currentDungeonId: string;
  currentDepth: number;
  currentRoomId: string;
  dungeonTick: number;
  hasGoldenCrystal: boolean;
  deeds: string[];
  mountSummoned: boolean;
}

export interface InventoryItem {
  itemId: string;
  name: string;
  kind: string;
  quantity: number;
  description: string;
  rarityId?: string;
}

// === Game State ===

export interface GameState {
  player: PlayerState;
  activeEnemies: Record<string, EntityDefinition[]>; // roomId -> enemies
  isInCombat: boolean;
  currentEnemy: EntityDefinition | null;
}

// === Content Pack ===

export interface ContentPack {
  dungeon: Dungeon;
  entities: EntityDefinition[];
  runes: RuneDefinition[];
  spells: SpellDefinition[];
  items: InventoryItem[];
  levelCurve: number[]; // XP needed per level
  spawnTable: SpawnEntry[];
}

export interface SpawnEntry {
  entityId: string;
  weight: number;
  minDepth?: number;
  maxDepth?: number;
}
