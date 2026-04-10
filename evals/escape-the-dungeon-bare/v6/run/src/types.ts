// ===== CORE TYPES =====

export type ElementType = 'fire' | 'ice' | 'lightning' | 'shadow' | 'nature' | 'arcane';
export type RoomType = 'combat' | 'elite' | 'forge' | 'rest' | 'event' | 'merchant' | 'boss' | 'training';
export type EquipSlot = 'main-hand' | 'off-hand' | 'body' | 'trinket';
export type ItemCategory = 'consumable' | 'rune' | 'equipment';

export interface Traits {
  aggression: number;    // 0-1
  compassion: number;    // 0-1
  arcaneAffinity: number; // 0-1
  cunning: number;       // 0-1
  resilience: number;    // 0-1
}

export interface Rune {
  id: string;
  name: string;
  element: ElementType;
  description: string;
  discovered: boolean;
}

export interface Spell {
  id: string;
  name: string;
  elements: ElementType[];
  runeIds: string[];
  damage: number;
  manaCost: number;
  effect?: SpellEffect;
  affinity: number;  // 0-100
  isCrafted: boolean;
  ingredients?: string[]; // spell/rune IDs used to make it
}

export interface SpellEffect {
  type: 'dot' | 'burst' | 'heal' | 'shield' | 'debuff' | 'stun' | 'drain' | 'reflect';
  value: number;
  duration?: number;
}

export interface PhysicalSkill {
  id: string;
  name: string;
  staminaCost: number;
  damage: number;
  effect?: SpellEffect;
  level: number;
  xpToNext: number;
  currentXp: number;
}

export interface SkillTreeNode {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  requires?: string[];
  skillId: string;
  cost: number; // skill points
}

export interface ActionPolicy {
  id: string;
  condition: string; // e.g. "hp < 30%"
  action: string;    // e.g. "use heal spell"
  priority: number;
  spellOrSkillId?: string;
  enabled: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  slot: EquipSlot;
  stats: Partial<{ attack: number; defense: number; maxHp: number; maxMana: number; maxStamina: number }>;
  element?: ElementType;
  description: string;
  value: number;
}

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  value: number;
  effect?: { type: 'heal-hp' | 'heal-mana' | 'heal-stamina' | 'buff' | 'key'; value: number };
  quantity: number;
  icon?: string;
}

export interface InventorySlot {
  item: Item | null;
}

export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  resistances: Partial<Record<ElementType, number>>; // 0-1 resistance
  weaknesses: ElementType[];
  traits: Traits;
  xpReward: number;
  goldReward: number;
  loot?: { itemId: string; chance: number }[];
  icon: string;
  behavior: 'aggressive' | 'defensive' | 'cowardly' | 'territorial';
  spells?: { name: string; element: ElementType; damage: number; manaCost: number }[];
}

export interface NPC {
  id: string;
  name: string;
  icon: string;
  traits: Traits;
  dialogue: DialogueNode[];
  met: boolean;
}

export interface DialogueNode {
  id: string;
  text: string;
  choices: DialogueChoice[];
  condition?: (state: GameState) => boolean;
}

export interface DialogueChoice {
  text: string;
  nextId?: string;
  traitShift?: Partial<Traits>;
  effect?: (state: GameState) => void;
  condition?: (state: GameState) => boolean;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  description: string;
  floor: number;
  cleared: boolean;
  discovered: boolean;
  connections: string[]; // room IDs
  enemies?: Enemy[];
  npc?: NPC;
  x: number; // map position
  y: number;
  icon: string;
  merchantStock?: (Item | Equipment | Rune)[];
  eventData?: EventData;
}

export interface EventData {
  text: string;
  choices: { text: string; effect: (state: GameState) => void; resultText: string }[];
}

export interface Floor {
  id: number;
  name: string;
  rooms: Room[];
  bossRoomId: string;
  mechanicalConstraint: string;
  unlocked: boolean;
}

export interface CombatLogEntry {
  text: string;
  type: 'action' | 'damage' | 'heal' | 'info' | 'trait' | 'policy';
  timestamp: number;
}

export interface Player {
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  attack: number;
  defense: number;
  traits: Traits;
  knownSpells: Spell[];
  equippedSpells: (Spell | null)[];  // 4-6 slots
  knownSkills: PhysicalSkill[];
  equippedSkills: (PhysicalSkill | null)[];  // 2-4 slots
  actionPolicies: ActionPolicy[];
  equipment: Record<EquipSlot, Equipment | null>;
  inventory: Item[];
  discoveredRunes: Rune[];
  skillPoints: number;
  skillTree: SkillTreeNode[];
  affinities: Record<ElementType, number>; // 0-100
}

export type GameScreen = 'title' | 'exploration' | 'combat' | 'forge' | 'rest'
  | 'merchant' | 'event' | 'dialogue' | 'inventory' | 'character' | 'map'
  | 'spellbook' | 'loadout' | 'gameover' | 'victory' | 'policies';

export interface GameState {
  screen: GameScreen;
  player: Player;
  floors: Floor[];
  currentFloor: number;
  currentRoomId: string;
  combatState: CombatState | null;
  combatLog: CombatLogEntry[];
  gameTime: number; // real ms elapsed
  gameStartTime: number;
  notifications: { text: string; type: string; id: number; expires: number }[];
  nextNotifId: number;
  roomTransitions: number;
  dialogueState: DialogueState | null;
  paused: boolean; // combat pause
}

export interface DialogueState {
  npcId: string;
  currentNodeId: string;
}

export interface CombatState {
  enemies: Enemy[];
  turn: number;
  playerTurnDone: boolean;
  enemyTurnDone: boolean;
  isAutoResolving: boolean;
  autoSpeed: number;
  combatOver: boolean;
  result: 'pending' | 'victory' | 'defeat';
  activeEffects: ActiveEffect[];
}

export interface ActiveEffect {
  targetType: 'player' | 'enemy';
  targetIndex?: number;
  type: SpellEffect['type'];
  value: number;
  turnsRemaining: number;
  source: string;
}
