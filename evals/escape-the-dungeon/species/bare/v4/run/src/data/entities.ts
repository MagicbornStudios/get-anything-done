import type { SpellElement } from "./runes";

export interface CombatStats {
  maxHp: number;
  currentHp: number;
  maxMana: number;
  currentMana: number;
  might: number;
  agility: number;
  defense: number;
  power: number;
  insight: number;
  willpower: number;
}

export interface Resistance {
  element: SpellElement | "physical";
  value: number; // -1 to 1. Positive = resistant (takes less), Negative = weak (takes more)
}

export interface EnemyType {
  id: string;
  name: string;
  sprite: string;
  stats: CombatStats;
  resistances: Resistance[];
  xpReward: number;
  crystalReward: number;
  behavior: EnemyBehavior;
  description: string;
  loot?: { itemId: string; chance: number }[];
}

export type EnemyBehavior =
  | "basic"          // just attacks
  | "defensive"      // raises defense sometimes
  | "spellcaster"    // uses elemental attacks
  | "berserker"      // hits harder at low HP
  | "regenerator"    // heals each turn
  | "reflector"      // reflects direct damage
  | "mana_drain";    // drains player mana

// Floor 1 enemies: resistant to physical, weak to DoT/status
export const FLOOR_1_ENEMIES: EnemyType[] = [
  {
    id: "slime",
    name: "Stone Slime",
    sprite: "🪨",
    stats: { maxHp: 45, currentHp: 45, maxMana: 0, currentMana: 0, might: 8, agility: 3, defense: 12, power: 0, insight: 2, willpower: 4 },
    resistances: [
      { element: "physical", value: 0.5 },  // 50% physical resist
      { element: "poison", value: -0.3 },    // weak to poison
    ],
    xpReward: 15,
    crystalReward: 5,
    behavior: "basic",
    description: "A gelatinous rock creature. Physical blows barely dent it.",
    loot: [{ itemId: "health_potion", chance: 0.3 }],
  },
  {
    id: "iron_beetle",
    name: "Iron Beetle",
    sprite: "🪲",
    stats: { maxHp: 55, currentHp: 55, maxMana: 0, currentMana: 0, might: 11, agility: 5, defense: 15, power: 0, insight: 3, willpower: 5 },
    resistances: [
      { element: "physical", value: 0.6 },  // very high physical resist
      { element: "fire", value: -0.4 },       // weak to fire
      { element: "lightning", value: -0.3 },   // weak to lightning
    ],
    xpReward: 20,
    crystalReward: 8,
    behavior: "defensive",
    description: "Armored insect with an iron carapace. Needs elemental attacks to crack.",
    loot: [{ itemId: "mana_potion", chance: 0.25 }],
  },
  {
    id: "moss_golem",
    name: "Moss Golem",
    sprite: "🌿",
    stats: { maxHp: 70, currentHp: 70, maxMana: 0, currentMana: 0, might: 10, agility: 2, defense: 10, power: 0, insight: 4, willpower: 6 },
    resistances: [
      { element: "physical", value: 0.4 },
      { element: "ice", value: -0.3 },
      { element: "fire", value: -0.5 },       // very weak to fire
    ],
    xpReward: 25,
    crystalReward: 10,
    behavior: "regenerator",
    description: "A plant-stone hybrid that regenerates each turn. Burn it fast or poison it.",
  },
];

// Floor 1 elite: forces crafted spell usage
export const FLOOR_1_ELITE: EnemyType = {
  id: "crystal_guardian",
  name: "Crystal Guardian",
  sprite: "💎",
  stats: { maxHp: 90, currentHp: 90, maxMana: 20, currentMana: 20, might: 14, agility: 4, defense: 18, power: 8, insight: 6, willpower: 8 },
  resistances: [
    { element: "physical", value: 0.7 },  // near-immune to physical
    { element: "arcane", value: 0.3 },
    { element: "poison", value: -0.5 },   // very weak to poison/DoT
    { element: "fire", value: -0.2 },
  ],
  xpReward: 40,
  crystalReward: 20,
  behavior: "spellcaster",
  description: "A towering crystal entity. Physical attacks bounce off. Only elemental magic or poison can penetrate.",
};

// Floor 1 boss
export const FLOOR_1_BOSS: EnemyType = {
  id: "warden_stone",
  name: "The Stone Warden",
  sprite: "🗿",
  stats: { maxHp: 150, currentHp: 150, maxMana: 30, currentMana: 30, might: 18, agility: 3, defense: 20, power: 12, insight: 8, willpower: 10 },
  resistances: [
    { element: "physical", value: 0.6 },
    { element: "ice", value: 0.3 },
    { element: "fire", value: -0.3 },
    { element: "poison", value: -0.4 },
  ],
  xpReward: 80,
  crystalReward: 50,
  behavior: "berserker",
  description: "Ancient warden of the first floor. Gets more dangerous as HP drops. Fire and poison are your best bets.",
  loot: [{ itemId: "golden_crystal", chance: 1.0 }],
};

// Floor 2 enemies: reflect direct damage, weak to DoT and indirect
export const FLOOR_2_ENEMIES: EnemyType[] = [
  {
    id: "mirror_wraith",
    name: "Mirror Wraith",
    sprite: "👻",
    stats: { maxHp: 60, currentHp: 60, maxMana: 15, currentMana: 15, might: 12, agility: 8, defense: 8, power: 10, insight: 7, willpower: 7 },
    resistances: [
      { element: "arcane", value: 0.5 },   // resist arcane
      { element: "physical", value: 0.3 },
      { element: "ice", value: -0.4 },      // weak to ice
      { element: "lightning", value: -0.3 },
    ],
    xpReward: 30,
    crystalReward: 12,
    behavior: "reflector",
    description: "Ethereal spirit that reflects direct damage back at the attacker. Use DoT or multi-hit.",
  },
  {
    id: "void_leech",
    name: "Void Leech",
    sprite: "🦑",
    stats: { maxHp: 50, currentHp: 50, maxMana: 25, currentMana: 25, might: 8, agility: 6, defense: 6, power: 14, insight: 9, willpower: 8 },
    resistances: [
      { element: "arcane", value: 0.6 },
      { element: "poison", value: 0.3 },
      { element: "fire", value: -0.4 },
      { element: "lightning", value: -0.3 },
    ],
    xpReward: 28,
    crystalReward: 10,
    behavior: "mana_drain",
    description: "Drains your mana each turn. Kill it fast with fire or lightning before you're drained dry.",
  },
  {
    id: "shadow_stalker",
    name: "Shadow Stalker",
    sprite: "🐺",
    stats: { maxHp: 45, currentHp: 45, maxMana: 10, currentMana: 10, might: 16, agility: 12, defense: 5, power: 8, insight: 8, willpower: 5 },
    resistances: [
      { element: "physical", value: -0.2 },  // weak to physical
      { element: "holy", value: -0.5 },
      { element: "arcane", value: 0.4 },
    ],
    xpReward: 25,
    crystalReward: 8,
    behavior: "berserker",
    description: "Fast and deadly but fragile. Hits harder when wounded.",
  },
];

export const FLOOR_2_ELITE: EnemyType = {
  id: "mana_devourer",
  name: "Mana Devourer",
  sprite: "🌀",
  stats: { maxHp: 100, currentHp: 100, maxMana: 40, currentMana: 40, might: 14, agility: 6, defense: 12, power: 16, insight: 10, willpower: 12 },
  resistances: [
    { element: "arcane", value: 0.7 },
    { element: "physical", value: 0.3 },
    { element: "fire", value: -0.3 },
    { element: "lightning", value: -0.4 },
    { element: "poison", value: -0.2 },
  ],
  xpReward: 55,
  crystalReward: 25,
  behavior: "mana_drain",
  description: "Devours magic. Drains 10 mana per turn. Physical attacks glance off. Lightning and fire pierce its shell.",
};

export const FLOOR_2_BOSS: EnemyType = {
  id: "void_king",
  name: "The Void King",
  sprite: "👑",
  stats: { maxHp: 200, currentHp: 200, maxMana: 50, currentMana: 50, might: 20, agility: 7, defense: 15, power: 18, insight: 12, willpower: 14 },
  resistances: [
    { element: "physical", value: 0.4 },
    { element: "arcane", value: 0.5 },
    { element: "fire", value: -0.2 },
    { element: "ice", value: -0.2 },
    { element: "lightning", value: -0.3 },
    { element: "poison", value: -0.2 },
  ],
  xpReward: 120,
  crystalReward: 80,
  behavior: "spellcaster",
  description: "Master of the void. Resists physical and arcane. Cycle through elemental spells to find weaknesses.",
  loot: [{ itemId: "golden_crystal", chance: 1.0 }],
};

// Player starting stats
export function createPlayerStats(): CombatStats {
  return {
    maxHp: 100,
    currentHp: 100,
    maxMana: 50,
    currentMana: 50,
    might: 10,
    agility: 8,
    defense: 6,
    power: 8,
    insight: 6,
    willpower: 6,
  };
}
