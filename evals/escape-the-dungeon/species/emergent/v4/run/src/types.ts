export type RoomFeature = "start" | "combat" | "elite" | "forge" | "rest" | "event" | "boss";

export interface Exit {
  to: string;
  label: string;
}

export interface EncounterSpec {
  enemy: string;
  count: number;
  elite?: boolean;
}

export interface Room {
  id: string;
  name: string;
  feature: RoomFeature;
  description: string;
  exits: Exit[];
  encounter?: EncounterSpec;
  event_id?: string;
  cleared?: boolean;
}

export interface Floor {
  id: string;
  name: string;
  icon: string;
  intel: string;
  pressure_note: string;
  start: string;
  rooms: Room[];
}

export interface Rune {
  id: string;
  name: string;
  icon: string;
  element: string;
  description: string;
}

export interface SpellEffect {
  type: "direct" | "dot" | "stun" | "drain";
  damage: number;
  dotDamage?: number;
  duration?: number;
  element: string;
  armorPierce?: boolean;
  ignoreShield?: boolean;
  stunTurns?: number;
  heal?: number;
  manaReturn?: number;
}

export interface Spell {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
  effect: SpellEffect;
  crafted?: boolean;
  inputs?: string[];
}

export interface EnemyDef {
  name: string;
  icon: string;
  maxHp: number;
  might: number;
  defense: number;
  xp: number;
  crystals: number;
  resistances: string[];
  reflects?: string;
  aura?: string;
  behavior: string;
  description: string;
  note?: string;
}

export interface EnemyInstance {
  def: EnemyDef;
  defKey: string;
  currentHp: number;
  statuses: StatusEffect[];
}

export interface StatusEffect {
  kind: "burn" | "bleed" | "poison" | "stun" | "slow";
  dmgPerTurn: number;
  turns: number;
  sourceSpell: string;
}

export interface EventChoice {
  label: string;
  effect: {
    heal?: number;
    crystals?: number;
    grantRune?: string;
    trait?: Record<string, number>;
    toast?: string;
  };
}

export interface GameEvent {
  title: string;
  story: string;
  choices: EventChoice[];
}

export interface Player {
  name: string;
  maxHp: number;
  currentHp: number;
  maxMana: number;
  currentMana: number;
  might: number;
  defense: number;
  agility: number;
  insight: number;
  willpower: number;
  power: number;
  xp: number;
  level: number;
  crystals: number;
  narrativeStats: Record<string, number>;
  runeAffinity: Record<string, number>;
  knownRunes: string[];
  spellbook: Spell[];
  statuses: StatusEffect[];
}

export interface GameState {
  player: Player;
  currentFloor: number;
  currentRoom: string;
  discoveredRooms: Record<string, string[]>;
  clearedRooms: Record<string, string[]>;
  floorsCleared: number;
  tick: number;
  floorForgeUseCount: Record<string, number>;
  craftedSpellUsedOnFloor: Record<string, boolean>;
  view: ViewName;
  combat?: CombatState;
  lastResultMsg?: string;
}

export interface CombatState {
  enemy: EnemyInstance;
  returnTo: string;
  log: CombatLogEntry[];
  turn: "player" | "enemy";
  ended: boolean;
  outcome?: "win" | "lose" | "flee";
  playerDamagedTick: number;
  enemyDamagedTick: number;
  usedCraftedSpellThisFight: boolean;
}

export interface CombatLogEntry {
  kind: "dmg" | "heal" | "spell" | "system";
  text: string;
}

export type ViewName =
  | "title"
  | "room"
  | "combat"
  | "forge"
  | "rest"
  | "event"
  | "victory"
  | "defeat";
