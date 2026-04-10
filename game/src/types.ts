// ============================================================
// Core data models for Escape the Dungeon
// ============================================================

export type Element = 'fire' | 'ice' | 'nature' | 'shadow' | 'arcane';
export type RoomType = 'combat' | 'elite' | 'forge' | 'rest' | 'event' | 'merchant' | 'boss' | 'training';
export type ItemCategory = 'consumable' | 'rune' | 'equipment';
export type EquipSlot = 'main-hand' | 'off-hand' | 'body' | 'trinket';

export interface Traits {
  aggression: number;   // 0-1
  compassion: number;   // 0-1
  cunning: number;      // 0-1
  resilience: number;   // 0-1
  arcaneAffinity: number; // 0-1
  [key: string]: number;
}

export interface EntityStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  xp: number;
  xpToLevel: number;
}

export interface Rune {
  id: string;
  name: string;
  element: Element;
  icon: string;
  description: string;
  discovered: boolean;
  affinityLevel: number; // 0-100
  affinityMilestones: { level: number; reward: string; claimed: boolean }[];
}

export interface Spell {
  id: string;
  name: string;
  elements: Element[];
  runeIds: string[];
  power: number;
  manaCost: number;
  effects: SpellEffect[];
  icon: string;
  tier: number; // 1=basic, 2=crafted, 3=evolved
  ingredients: string[]; // ids of runes/spells used to craft
}

export interface SpellEffect {
  type: 'damage' | 'dot' | 'heal' | 'buff' | 'debuff' | 'status';
  element?: Element;
  value: number;
  duration?: number; // turns
  description: string;
}

export interface PhysicalSkill {
  id: string;
  name: string;
  staminaCost: number;
  damage: number;
  effects: SpellEffect[];
  icon: string;
  unlocked: boolean;
  tier: number;
  prerequisites: string[];
}

export interface ActionPolicy {
  id: string;
  condition: string; // e.g. 'hp_below_30', 'enemy_weak_to_fire', 'always'
  action: string;    // spell/skill id or 'attack'
  priority: number;  // lower = higher priority
}

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  icon: string;
  description: string;
  quantity: number;
  equipSlot?: EquipSlot;
  statBonuses?: Partial<EntityStats>;
  element?: Element;
  value: number; // gold value
}

export interface Equipment {
  'main-hand': Item | null;
  'off-hand': Item | null;
  'body': Item | null;
  'trinket': Item | null;
}

export interface Enemy {
  id: string;
  name: string;
  icon: string;
  stats: EntityStats;
  traits: Traits;
  loot: { itemId: string; chance: number }[];
  resistances: Partial<Record<Element, number>>; // 0-1, damage multiplier
  weaknesses: Partial<Record<Element, number>>;  // >1, damage multiplier
  actionPolicies: ActionPolicy[];
  xpReward: number;
  goldReward: number;
  spells: Spell[];
  description: string;
}

export interface NPC {
  id: string;
  name: string;
  icon: string;
  traits: Traits;
  dialogue: DialogueNode[];
  portrait: string;
}

export interface DialogueNode {
  id: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueChoice {
  text: string;
  nextNodeId?: string; // null = end dialogue
  traitRequirement?: { trait: string; minValue: number };
  effects: DialogueEffect[];
}

export interface DialogueEffect {
  type: 'item' | 'rune' | 'trait' | 'gold' | 'spawn_enemy' | 'quest_flag' | 'merchant_discount';
  id?: string;
  value?: number;
  traitKey?: string;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  floor: number;
  description: string;
  icon: string;
  connections: string[]; // room ids
  enemies?: Enemy[];
  npc?: NPC;
  merchantStock?: Item[];
  cleared: boolean;
  discovered: boolean;
  gridX: number;
  gridY: number;
  lootTable?: { itemId: string; chance: number }[];
  runeReward?: string; // rune id found here
}

export interface Floor {
  id: number;
  name: string;
  rooms: Room[];
  mechanicalConstraint: string;
  bossRoomId: string;
  cleared: boolean;
}

export interface PlayerState {
  name: string;
  stats: EntityStats;
  traits: Traits;
  runes: Rune[];
  spells: Spell[];
  physicalSkills: PhysicalSkill[];
  spellLoadout: (Spell | null)[];  // 4 slots
  skillLoadout: (PhysicalSkill | null)[]; // 3 slots
  actionPolicies: ActionPolicy[];
  inventory: Item[];
  equipment: Equipment;
  gold: number;
  currentFloor: number;
  currentRoomId: string;
  questFlags: Record<string, boolean>;
  discoveredRunes: string[];
  gameClockStart: number; // timestamp
}

export interface GameState {
  player: PlayerState;
  floors: Floor[];
  started: boolean;
  gameOver: boolean;
  currentScene: string;
  toasts: { id: number; text: string; type: string; timestamp: number }[];
}

export interface MerchantTransaction {
  type: 'buy' | 'sell' | 'trade';
  item: Item;
  cost: number;
}
