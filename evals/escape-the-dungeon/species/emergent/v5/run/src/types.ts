// Core game types

export interface FloorData {
  id: string;
  name: string;
  theme: string;
  pressure_note: string;
  rooms: RoomData[];
}

export interface RoomData {
  id: string;
  name: string;
  type: 'entrance' | 'corridor' | 'combat' | 'boss' | 'merchant' | 'dialogue' | 'forge' | 'rest';
  icon: string;
  description: string;
  exits: string[];
  enemy?: EnemyData;
  merchant?: MerchantData;
  npc?: NpcData;
  bossGateToFloor?: string;
}

export interface EnemyData {
  name: string;
  icon: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  directResist: number;
  dotResist: number;
  reflectDamage: number;
  manaDrainPerTurn?: number;
  xpReward: number;
  goldReward: number;
  traits: Record<string, number>;
  loot: LootEntry[];
}

export interface LootEntry {
  type: string;
  id?: string;
  chance: number;
  value?: any;
}

export interface MerchantData {
  name: string;
  icon: string;
  inventory: ShopItem[];
}

export interface ShopItem {
  id: string;
  name: string;
  type: string;
  icon: string;
  cost: number;
  slot?: string;
  effect?: Record<string, number>;
  stats?: Record<string, number>;
}

export interface NpcData {
  name: string;
  icon: string;
  greeting: string;
  branches: DialogueBranch[];
}

export interface DialogueBranch {
  text: string;
  traitShift: Record<string, number>;
  response: string;
  reward: { type: string; value: any } | null;
}

export interface RuneData {
  id: string;
  name: string;
  element: string;
  icon: string;
}

export interface RecipeData {
  id: string;
  name: string;
  icon: string;
  elements: string[];
  manaCost: number;
  description: string;
  effect: SpellEffect;
}

export interface SpellEffect {
  type: 'direct' | 'dot' | 'heal' | 'buff' | 'shield';
  damage?: number;
  turns?: number;
  element?: string;
  bypassReflect?: boolean;
  amount?: number;
  hpCost?: number;
  manaRestore?: number;
  spellPowerBuff?: number;
  buffTurns?: number;
  absorb?: number;
}

export interface SpellData {
  id: string;
  name: string;
  icon: string;
  manaCost: number;
  description: string;
  effect: SpellEffect;
  isStarter?: boolean;
  isCrafted?: boolean;
  affinityUses?: number;
}

export interface SkillTreeNode {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  effect: Record<string, number>;
  requires: string[];
}

export interface EquipmentItem {
  id: string;
  name: string;
  type: 'equipment';
  slot: string;
  icon: string;
  stats: Record<string, number>;
}

export interface ConsumableItem {
  id: string;
  name: string;
  type: 'consumable';
  icon: string;
  effect: Record<string, number>;
}

export interface RuneItem {
  id: string;
  name: string;
  type: 'rune';
  icon: string;
  element: string;
}

export type InventoryItem = EquipmentItem | ConsumableItem | RuneItem;

export interface StatusEffect {
  kind: string;
  dmgPerTurn: number;
  turns: number;
  sourceSpell: string;
  element?: string;
}

export interface ShieldEffect {
  absorb: number;
  turns: number;
}

export interface BuffEffect {
  spellPower: number;
  turns: number;
}

export interface CombatPolicy {
  lowHpThreshold: number; // % HP to trigger heal
  preferDot: boolean;
  useForgeSpells: boolean;
  conserveMana: boolean;
}

export interface CombatLogEntry {
  actor: 'player' | 'enemy' | 'system';
  text: string;
  type: 'damage' | 'heal' | 'dot' | 'status' | 'info' | 'reflect' | 'drain';
}

export interface CombatState {
  enemy: EnemyData & { statusEffects: StatusEffect[] };
  playerStatusEffects: StatusEffect[];
  playerShield: ShieldEffect | null;
  playerBuff: BuffEffect | null;
  log: CombatLogEntry[];
  turn: number;
  phase: 'setup' | 'running' | 'paused' | 'victory' | 'defeat';
  autoRunning: boolean;
}

export type ViewName = 'title' | 'game' | 'combat' | 'merchant' | 'dialogue' | 'forge' | 'inventory' | 'character' | 'map' | 'victory' | 'defeat' | 'combatSetup';

export interface GameState {
  view: ViewName;
  currentFloorId: string;
  currentRoomId: string;
  player: {
    name: string;
    level: number;
    xp: number;
    xpToNext: number;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    attack: number;
    defense: number;
    spellPower: number;
    gold: number;
    traits: Record<string, number>;
    inventory: InventoryItem[];
    equipment: Record<string, EquipmentItem | null>;
    spells: SpellData[];
    runes: RuneItem[];
    discoveredRecipes: string[];
    craftedSpellUsedOnFloor: Record<string, boolean>;
    skillPoints: number;
    unlockedSkills: string[];
    loadout: {
      spellSlots: (string | null)[];
    };
    combatPolicy: CombatPolicy;
    affinities: Record<string, number>; // element -> cast count
  };
  clearedRooms: string[];
  visitedRooms: string[];
  dialogueChoicesMade: Record<string, number>;
  combat: CombatState | null;
  floorsData: FloorData[];
  runesData: RuneData[];
  recipesData: RecipeData[];
  skillTreeData: SkillTreeNode[];
  starterSpells: SpellData[];
  turnsElapsed: number; // pressure: total turns across all combats
  hungerLevel: number; // pressure: increases over time, reduces stats
}
