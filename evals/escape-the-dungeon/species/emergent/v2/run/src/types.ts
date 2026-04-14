// ===== Core Types =====

export interface CombatStats {
  maxHp: number;
  maxMana: number;
  currentHp: number;
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
  baseStats: Omit<CombatStats, "currentHp" | "currentMana">;
  description: string;
  color: string;
  icon: string;
}

export interface Archetype {
  id: string;
  name: string;
  statModifiers: Partial<Record<string, number>>;
  description: string;
}

export interface NPC {
  id: string;
  name: string;
  entityType: string;
  color: string;
  icon: string;
  greeting: string;
  dialogue: DialogueOption[];
}

export interface DialogueOption {
  text: string;
  response: string;
  effect: DialogueEffect | null;
}

export interface DialogueEffect {
  type: string;
  amount?: number;
  runeId?: string;
  item?: string;
  cost?: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  type: string;
  exits: Record<string, string>;
  enemyType?: string;
  npcId?: string;
  loot?: { crystals: number };
}

export interface Floor {
  id: string;
  name: string;
  rooms: Room[];
}

export interface Rune {
  id: string;
  name: string;
  element: string;
  color: string;
  icon: string;
  description: string;
}

export interface SpellRecipe {
  id: string;
  name: string;
  runes: string[];
  manaCost: number;
  damage: number;
  element: string;
  description: string;
  color: string;
  effect?: {
    type: string;
    stat?: string;
    amount: number;
    duration?: number;
  };
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: string;
  effect?: { type: string; amount: number };
  icon: string;
  color: string;
}

export interface BuffEffect {
  stat: string;
  amount: number;
  turnsRemaining: number;
}

export interface PlayerState {
  name: string;
  archetypeId: string;
  combatStats: CombatStats;
  runes: string[];           // rune ids in inventory
  craftedSpells: string[];   // spell recipe ids
  equippedSpells: string[];  // spell recipe ids (prepared)
  items: Record<string, number>; // item id → count
  crystals: number;
  xp: number;
  level: number;
  currentFloorId: string;
  currentRoomId: string;
  discoveredRooms: string[];
  collectedTreasure: string[];
  dungeonTick: number;
  buffs: BuffEffect[];
}

export interface GameState {
  player: PlayerState;
  contentLoaded: boolean;
}

// Content pack data
export interface ContentData {
  entityTypes: EntityType[];
  archetypes: Archetype[];
  npcs: NPC[];
  floors: Floor[];
  runes: Rune[];
  recipes: SpellRecipe[];
  starterSpells: string[];
  starterRunes: string[];
  items: Item[];
}
