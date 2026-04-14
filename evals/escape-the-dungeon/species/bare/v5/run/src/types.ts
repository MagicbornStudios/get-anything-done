export type DamageType =
  | "physical"
  | "fire"
  | "ice"
  | "poison"
  | "arcane";

export type StatusEffect = {
  kind: "dot" | "slow" | "burn" | "shield" | "empower";
  turns: number;
  magnitude: number;
  damageType?: DamageType;
  source?: string;
};

export type CombatStats = {
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
};

export type NarrativeStats = Record<string, number>;

export type Resistance = {
  fire?: number; // 0..2, 1=normal, 0=immune, 2=weak
  ice?: number;
  poison?: number;
  arcane?: number;
  physical?: number;
};

export type Enemy = {
  id: string;
  name: string;
  icon: string;
  combatStats: CombatStats;
  resistances: Resistance;
  xpReward: number;
  crystalReward: number;
  ai: "basic" | "reflect" | "hard";
  reflectPct?: number;
  notes?: string;
};

export type Rune = {
  id: string;
  letter: string;
  name: string;
  icon: string;
  color: string; // css class
  damageType: DamageType;
};

export type Spell = {
  id: string;
  name: string;
  icon: string;
  runes: string[];
  manaCost: number;
  crystalCost?: number;
  description: string;
  power: number;
  damageType: DamageType;
  effects?: StatusEffect[];
  selfHeal?: number;
  target: "enemy" | "self";
  aoe?: boolean;
};

export type Skill = {
  id: string;
  name: string;
  icon: string;
  description: string;
  power: number;
  damageType: DamageType;
  manaCost: number; // 0 for physical
  crystalOvercharge?: {
    crystalCost: number;
    bonus: number;
    addEffect?: StatusEffect;
  };
};

export type RoomType =
  | "start"
  | "combat"
  | "elite"
  | "forge"
  | "rest"
  | "event"
  | "boss";

export type Exit = {
  to: string;
  label?: string;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  feature: RoomType;
  icon: string;
  exits: Exit[];
  enemyIds?: string[];
  cleared?: boolean;
  eventId?: string;
  floorId: string;
  respawn?: boolean;
};

export type EventChoice = {
  label: string;
  outcome: string;
  effect?: {
    hp?: number;
    mana?: number;
    crystals?: number;
    xp?: number;
    trait?: { name: string; delta: number };
  };
};

export type EventDef = {
  id: string;
  name: string;
  text: string;
  choices: EventChoice[];
};

export type Floor = {
  id: string;
  name: string;
  description: string;
  theme: string;
  mechanicalConstraint: string;
  rooms: Room[];
  bossRoomId: string;
  startRoomId: string;
};

export type Player = {
  name: string;
  floorIndex: number;
  currentRoomId: string;
  combatStats: CombatStats;
  narrativeStats: NarrativeStats;
  runeAffinity: Record<string, number>;
  crystals: number;
  xp: number;
  level: number;
  knownSpellIds: string[];
  preparedSpellIds: string[];
  skillIds: string[];
  discoveredRoomIds: string[];
  clearedRoomIds: string[];
  defeatedBossIds: string[];
  tick: number;
  activeEffects: StatusEffect[];
};

export type Scene =
  | { kind: "title" }
  | { kind: "room"; roomId: string }
  | { kind: "combat"; roomId: string; enemies: EnemyInstance[]; isBoss?: boolean }
  | { kind: "forge"; roomId: string }
  | { kind: "rest"; roomId: string }
  | { kind: "event"; roomId: string; eventId: string }
  | { kind: "gameover"; reason: string }
  | { kind: "victory" };

export type EnemyInstance = Enemy & {
  activeEffects: StatusEffect[];
};
