// ===== GAME TYPES =====

export interface CombatStats {
  maxHp: number;
  currentHp: number;
  maxMana: number;
  currentMana: number;
  might: number;
  agility: number;
  insight: number;
  willpower: number;
  defense: number;
  power: number;
}

export interface Spell {
  id: string;
  name: string;
  runes: string[];
  manaCost: number;
  damage: number;
  element: string;
  type: "direct" | "dot" | "drain" | "buff" | "restore_mana";
  description: string;
  dotDamage?: number;
  dotTurns?: number;
  healPercent?: number;
  statusEffect?: { type: string; turns: number };
  buffStat?: string;
  buffAmount?: number;
  buffTurns?: number;
  restoreMana?: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: string;
  effect?: Record<string, unknown>;
  icon: string;
  quantity: number;
}

export interface RuneData {
  id: string;
  name: string;
  element: string;
  icon: string;
  color: string;
}

export interface StatusEffect {
  type: string;
  turns: number;
  damage?: number;
}

export interface Entity {
  name: string;
  entityType: string;
  archetype: string;
  level: number;
  combatStats: CombatStats;
  isBoss?: boolean;
  resistances?: Record<string, number>;
  reflectSpells?: boolean;
  manadrainAura?: boolean;
  statusEffects: StatusEffect[];
  buffedStats: Record<string, { amount: number; turns: number }>;
}

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  combatStats: CombatStats;
  spells: Spell[];
  spellSlots: number;
  inventory: Item[];
  crystals: number;
  runes: string[];  // owned rune IDs
  runeAffinity: Record<string, number>;
  statusEffects: StatusEffect[];
  buffedStats: Record<string, { amount: number; turns: number }>;
  killCount: number;
}

export interface RoomData {
  id: string;
  name: string;
  description: string;
  feature: string;
  exits: Record<string, string>;
  enemy?: {
    entityType: string;
    archetype: string;
    level: number;
    isBoss?: boolean;
  };
  resistances?: Record<string, number>;
  reflectSpells?: boolean;
  manadrainAura?: boolean;
  npcId?: string;
  loot?: { crystals?: number; item?: string };
}

export interface FloorData {
  id: string;
  name: string;
  mechanicalConstraint: string;
  rooms: RoomData[];
}

export interface GameState {
  player: PlayerState;
  currentFloorIndex: number;
  currentRoomId: string;
  discoveredRooms: Set<string>;
  clearedRooms: Set<string>;
  dungeonTick: number;
  gameOver: boolean;
  victory: boolean;
}

export interface ContentPacks {
  entities: any;
  floors: { floors: FloorData[] };
  items: any;
  spells: any;
  dialogue: any;
}
