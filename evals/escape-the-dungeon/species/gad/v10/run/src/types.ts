// Canonical types for Escape the Dungeon.
// narrativeStats = code name, "Traits" = UI label (see decision etd-01 requirements mapping).

export type DamageType = "physical" | "fire" | "cold" | "shock" | "poison" | "arcane";
export type StatusEffect = "burn" | "chill" | "shock" | "poison" | "bleed" | "stun";

export interface CombatStats {
  maxHp: number;
  currentHp: number;
  maxMana: number;
  currentMana: number;
  might: number;
  agility: number;
  insight: number;
  defense: number;
  power: number;
}

export type NarrativeStatKey =
  | "Comprehension" | "Constraint" | "Construction" | "Direction" | "Empathy"
  | "Equilibrium" | "Freedom" | "Levity" | "Projection" | "Survival"
  | "Fame" | "Effort" | "Awareness" | "Guile" | "Momentum";

export type NarrativeStats = Partial<Record<NarrativeStatKey, number>>;

export interface ActiveStatus {
  effect: StatusEffect;
  turns: number;
  magnitude: number;
}

export interface Enemy {
  id: string;
  name: string;
  icon: string;            // iconify id
  tags: string[];          // display tags (fire, resist, etc.)
  combatStats: CombatStats;
  xpReward: number;
  crystalReward: number;
  resistances?: Partial<Record<DamageType, number>>; // 0..1 reduction
  immune?: DamageType[];
  reflect?: DamageType[];  // direct damage of these types is reflected
  weak?: DamageType[];     // takes +50% dmg
  flavor: string;
  ai?: "basic" | "reflect" | "warden" | "lich";
}

export interface Rune {
  id: string;
  name: string;
  icon: string;
  type: "element" | "form" | "force";
  element?: DamageType;
  desc: string;
}

export interface Spell {
  id: string;
  name: string;
  icon: string;
  cost: number;
  desc: string;
  damage: number;
  damageType: DamageType;
  status?: { effect: StatusEffect; turns: number; magnitude: number };
  kind: "direct" | "dot" | "summon" | "heal" | "shield" | "drain";
  runes?: string[]; // ids of composed runes for crafted spells
}

export type RoomType =
  | "start" | "combat" | "elite" | "forge" | "rest" | "event" | "treasure" | "boss" | "exit";

export interface Room {
  id: string;
  floor: number;
  name: string;
  type: RoomType;
  desc: string;
  icon: string;
  exits: { dir: string; to: string }[];
  enemyId?: string;         // for combat/elite/boss
  eventId?: string;         // for event rooms
  cleared?: boolean;
  discovered?: boolean;
  respawnCadence?: number;  // ticks
  lastRespawnTick?: number;
}

export interface Floor {
  number: number;
  name: string;
  description: string;
  startRoomId: string;
  bossRoomId: string;
  constraint: string;       // flavor hint shown on entry
}

export type SceneName = "title" | "room" | "combat" | "forge" | "event" | "game-over" | "victory";

export interface GameState {
  scene: SceneName;
  playerName: string;
  floor: number;
  currentRoomId: string;
  tick: number;
  crystals: number;
  xp: number;
  level: number;
  combatStats: CombatStats;
  skillStats: { Slashing: number; Bludgeoning: number; Ranged: number; Magic: number };
  narrativeStats: NarrativeStats;
  runeAffinity: Record<string, number>;
  knownRunes: string[];
  spells: Spell[];
  equippedSpells: string[];
  discoveredRooms: Record<string, boolean>;
  clearedRooms: Record<string, boolean>;
  lastRoomBeforeCombat?: string;
  pendingCombatEnemyId?: string;
  pendingEventId?: string;
  activeEnemyStatuses?: ActiveStatus[];
  log: string[];
}

export interface EventChoice {
  label: string;
  outcome: string;
  effect?: (s: GameState) => void;
}

export interface GameEvent {
  id: string;
  npcName: string;
  portrait: string;
  text: string;
  choices: EventChoice[];
}
