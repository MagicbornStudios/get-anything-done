// ============================================================
// Core data models for Escape the Dungeon v12
// ============================================================

export type Element = 'fire' | 'ice' | 'nature' | 'shadow' | 'arcane';
export type RoomType = 'combat' | 'elite' | 'forge' | 'rest' | 'event' | 'merchant' | 'boss' | 'training';
export type ItemCategory = 'consumable' | 'rune' | 'equipment';
export type EquipSlot = 'main-hand' | 'off-hand' | 'body' | 'trinket';

export interface Traits {
  aggression: number;
  compassion: number;
  cunning: number;
  resilience: number;
  arcaneAffinity: number;
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
  affinityLevel: number;
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
  tier: number;
  ingredients: string[];
}

export interface SpellEffect {
  type: 'damage' | 'dot' | 'heal' | 'buff' | 'debuff' | 'status';
  element?: Element;
  value: number;
  duration?: number;
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
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
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
  value: number;
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
  resistances: Partial<Record<Element, number>>;
  weaknesses: Partial<Record<Element, number>>;
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
  speaker?: string;
  choices: DialogueChoice[];
}

export interface DialogueChoice {
  text: string;
  nextNodeId?: string;
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
  connections: string[];
  enemies?: Enemy[];
  npc?: NPC;
  merchantStock?: Item[];
  cleared: boolean;
  discovered: boolean;
  gridX: number;
  gridY: number;
  lootTable?: { itemId: string; chance: number }[];
  runeReward?: string;
}

export interface Floor {
  id: number;
  name: string;
  rooms: Room[];
  mechanicalConstraint: string;
  bossRoomId: string;
  cleared: boolean;
}

export interface CombatLogEntry {
  text: string;
  type: 'action' | 'damage' | 'heal' | 'status' | 'info' | 'trait';
  timestamp: number;
}

export interface PlayerState {
  name: string;
  stats: EntityStats;
  traits: Traits;
  runes: Rune[];
  spells: Spell[];
  physicalSkills: PhysicalSkill[];
  spellLoadout: (string | null)[];
  skillLoadout: (string | null)[];
  actionPolicies: ActionPolicy[];
  inventory: Item[];
  equipment: Equipment;
  gold: number;
  currentFloor: number;
  currentRoomId: string;
  questFlags: Record<string, boolean>;
  discoveredRunes: string[];
  gameClockStart: number;
}

export interface GameState {
  player: PlayerState;
  floors: Floor[];
  started: boolean;
  gameOver: boolean;
  victory: boolean;
  currentScene: string;
  combatLog: CombatLogEntry[];
  combatPaused: boolean;
  combatActive: boolean;
}

export interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'success' | 'warning' | 'danger' | 'trait';
  timestamp: number;
}
