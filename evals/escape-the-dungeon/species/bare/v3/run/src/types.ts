// ============================================================
// Core game types
// ============================================================

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

export interface Player {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  combatStats: CombatStats;
  inventory: InventoryItem[];
  spells: Spell[];
  runes: Rune[];
  crystals: number;
  currentRoomId: string;
  currentFloor: number;
  discoveredRooms: string[];
  tick: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: "potion" | "scroll" | "equipment" | "key";
  effect?: ItemEffect;
  quantity: number;
}

export interface ItemEffect {
  stat: keyof CombatStats;
  value: number;
}

export interface Rune {
  id: string;
  name: string;
  symbol: string;
  color: string;
  description: string;
}

export interface SpellRecipe {
  rune1: string;
  rune2: string;
  resultSpellId: string;
}

export interface Spell {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  damage: number;
  icon: string;
  element: string;
  effect?: "heal" | "damage" | "buff" | "debuff";
  effectValue?: number;
  runeComposition: string[];
}

export type RoomType = "combat" | "dialogue" | "treasure" | "rest" | "forge" | "boss" | "start";

export interface Room {
  id: string;
  name: string;
  description: string;
  type: RoomType;
  floor: number;
  exits: { direction: string; targetRoomId: string }[];
  enemyId?: string;
  npcId?: string;
  loot?: string[];
  visited?: boolean;
}

export interface Enemy {
  id: string;
  name: string;
  description: string;
  combatStats: CombatStats;
  xpReward: number;
  crystalReward: number;
  sprite: string;
  color: string;
  loot?: string[];
}

export interface NPC {
  id: string;
  name: string;
  portrait: string;
  color: string;
  greeting: string;
  dialogueOptions: DialogueOption[];
}

export interface DialogueOption {
  text: string;
  response: string;
  effect?: DialogueEffect;
  requireItem?: string;
}

export interface DialogueEffect {
  type: "giveItem" | "giveSpell" | "giveRune" | "heal" | "info" | "shop";
  itemId?: string;
  spellId?: string;
  runeId?: string;
  healAmount?: number;
}

export type GameScene = "title" | "room" | "combat" | "dialogue" | "forge" | "gameover";

export interface GameState {
  scene: GameScene;
  player: Player;
  currentEnemy?: Enemy;
  currentNPC?: NPC;
  combatLog: string[];
  menuOpen?: "bag" | "spellbook" | "stats" | "map" | null;
}
