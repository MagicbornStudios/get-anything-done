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

export interface NarrativeStats {
  comprehension: number;
  constraint: number;
  construction: number;
  direction: number;
  empathy: number;
  equilibrium: number;
  freedom: number;
  levity: number;
  projection: number;
  survival: number;
  fame: number;
  effort: number;
  awareness: number;
  guile: number;
  momentum: number;
}

export interface SkillStats {
  slashing: number;
  bludgeoning: number;
  ranged: number;
  magic: number;
}

export interface RuneAffinity {
  [runeId: string]: number;
}

export interface Spell {
  id: string;
  name: string;
  runes: string[];
  manaCost: number;
  damage: number;
  damageType: DamageType;
  effect?: SpellEffect;
  description: string;
  crafted: boolean;
}

export type DamageType = "physical" | "fire" | "ice" | "lightning" | "poison" | "arcane";

export type SpellEffect = "dot" | "stun" | "slow" | "burst" | "heal" | "shield" | "drain";

export interface Item {
  id: string;
  name: string;
  type: "potion" | "scroll" | "crystal" | "key";
  description: string;
  effect: string;
  value: number;
}

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  combatStats: CombatStats;
  narrativeStats: NarrativeStats;
  skillStats: SkillStats;
  runeAffinity: RuneAffinity;
  spells: Spell[];
  items: Item[];
  crystals: number;
  currentFloor: number;
  currentRoom: string;
  discoveredRooms: string[];
  clearedRooms: string[];
  tick: number;
}

export type RoomType = "combat" | "elite" | "forge" | "rest" | "event" | "boss" | "dialogue" | "treasure" | "start";

export interface RoomExit {
  direction: string;
  targetRoom: string;
  label: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  type: RoomType;
  exits: RoomExit[];
  enemyId?: string;
  npcId?: string;
  cleared: boolean;
  respawnTicks?: number;
}

export interface Floor {
  id: number;
  name: string;
  rooms: Room[];
  bossRoomId: string;
  mechanicalConstraint: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  combatStats: CombatStats;
  resistances: Partial<Record<DamageType, number>>; // 0-1 = reduction, >1 = weakness
  immunities: DamageType[];
  xpReward: number;
  crystalReward: number;
  behavior: string;
  description: string;
}

export interface RuneDef {
  id: string;
  name: string;
  element: DamageType;
  icon: string;
  color: string;
  description: string;
}

export interface SpellRecipe {
  runes: string[];
  result: Omit<Spell, "crafted">;
}

export interface NpcDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  greeting: string;
  dialogue: DialogueNode[];
}

export interface DialogueNode {
  id: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueChoice {
  text: string;
  nextNode?: string;
  effect?: {
    type: "give_item" | "heal" | "give_crystals" | "give_xp" | "stat_change";
    itemId?: string;
    amount?: number;
    stat?: string;
  };
  requirement?: {
    stat: string;
    min: number;
  };
}

export interface GameState {
  player: PlayerState;
  floors: Floor[];
  gameOver: boolean;
  victory: boolean;
}
