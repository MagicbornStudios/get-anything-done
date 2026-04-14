import type { Enemy } from "../types";

// Pressure design: starter spells (Arcane Bolt, Spark) are direct damage only.
// Stone Warden resists physical and heavily resists arcane -> forces DoT/poison.
// Mirror Djinn reflects direct damage -> forces DoT/summon (indirect).
// Pyre Lich is fire-immune + reflects direct -> forces poison DoT or drain.
// This is the ingenuity payoff (G2 + G4).

export const ENEMIES: Record<string, Enemy> = {
  // -------- Floor 1 --------
  slime_mote: {
    id: "slime_mote",
    name: "Dripping Mote",
    icon: "game-icons:slime",
    tags: ["physical"],
    combatStats: {
      maxHp: 14, currentHp: 14, maxMana: 0, currentMana: 0,
      might: 3, agility: 2, insight: 0, defense: 1, power: 0,
    },
    xpReward: 6,
    crystalReward: 3,
    flavor: "A quivering blob dripping acid.",
    ai: "basic",
  },
  bone_scout: {
    id: "bone_scout",
    name: "Bone Scout",
    icon: "game-icons:crossed-bones",
    tags: ["physical"],
    combatStats: {
      maxHp: 18, currentHp: 18, maxMana: 0, currentMana: 0,
      might: 4, agility: 4, insight: 0, defense: 2, power: 0,
    },
    weak: ["fire"],
    xpReward: 8,
    crystalReward: 4,
    flavor: "Skeletal rattling through the dark.",
    ai: "basic",
  },
  ember_wisp: {
    id: "ember_wisp",
    name: "Ember Wisp",
    icon: "game-icons:fairy",
    tags: ["fire", "weak: cold"],
    combatStats: {
      maxHp: 12, currentHp: 12, maxMana: 6, currentMana: 6,
      might: 2, agility: 5, insight: 4, defense: 1, power: 5,
    },
    weak: ["cold"],
    resistances: { fire: 0.5 },
    xpReward: 9,
    crystalReward: 5,
    flavor: "A spiteful flicker of firelight.",
    ai: "basic",
  },
  // Floor 1 ELITE: resists physical & arcane, immune to direct damage spells.
  // Starter spells will barely tickle it. Must use DoT (Wildfire / Venom Frost).
  stone_warden: {
    id: "stone_warden",
    name: "Stone Warden",
    icon: "game-icons:stone-tower",
    tags: ["physical", "resist: arcane"],
    combatStats: {
      maxHp: 44, currentHp: 44, maxMana: 0, currentMana: 0,
      might: 7, agility: 1, insight: 0, defense: 6, power: 0,
    },
    resistances: { physical: 0.75, arcane: 0.85, shock: 0.6 },
    xpReward: 20,
    crystalReward: 10,
    flavor: "A slab of dungeon stone with eyes. It shrugs off spells, but not rot.",
    ai: "warden",
  },
  // Floor 1 BOSS: heavy, physical-resistant, punishes spell spam with a counter-slam.
  iron_gaoler: {
    id: "iron_gaoler",
    name: "The Iron Gaoler",
    icon: "game-icons:prisoner",
    tags: ["physical", "resist: physical"],
    combatStats: {
      maxHp: 60, currentHp: 60, maxMana: 0, currentMana: 0,
      might: 9, agility: 3, insight: 0, defense: 5, power: 0,
    },
    resistances: { physical: 0.6 },
    weak: ["poison", "fire"],
    xpReward: 40,
    crystalReward: 20,
    flavor: "Keeper of the lower keep. Rusted, relentless, allergic to fire and poison.",
    ai: "basic",
  },

  // -------- Floor 2 --------
  gloom_bat: {
    id: "gloom_bat",
    name: "Gloom Bat",
    icon: "game-icons:bat",
    tags: ["physical"],
    combatStats: {
      maxHp: 16, currentHp: 16, maxMana: 0, currentMana: 0,
      might: 5, agility: 6, insight: 0, defense: 1, power: 0,
    },
    weak: ["shock"],
    xpReward: 10,
    crystalReward: 5,
    flavor: "Screeches in the deep.",
    ai: "basic",
  },
  wraith: {
    id: "wraith",
    name: "Whispering Wraith",
    icon: "game-icons:ghost",
    tags: ["arcane"],
    combatStats: {
      maxHp: 22, currentHp: 22, maxMana: 10, currentMana: 10,
      might: 3, agility: 5, insight: 5, defense: 2, power: 6,
    },
    resistances: { physical: 0.5, cold: 0.4 },
    weak: ["fire"],
    xpReward: 14,
    crystalReward: 7,
    flavor: "A soul half-escaped from a forgotten oath.",
    ai: "basic",
  },
  // Floor 2 ELITE: reflects direct damage types. Must use DoT or drain.
  mirror_djinn: {
    id: "mirror_djinn",
    name: "Mirror Djinn",
    icon: "game-icons:djinn",
    tags: ["reflect", "arcane"],
    combatStats: {
      maxHp: 50, currentHp: 50, maxMana: 8, currentMana: 8,
      might: 4, agility: 4, insight: 6, defense: 3, power: 7,
    },
    reflect: ["fire", "cold", "shock", "arcane", "physical"],
    resistances: { physical: 0.3 },
    xpReward: 28,
    crystalReward: 14,
    flavor: "Its skin is polished silver. Direct attacks return to their source. But rot and storms obey no mirror.",
    ai: "reflect",
  },
  // Floor 2 BOSS: fire-immune + reflects direct damage.
  // Must use poison DoT or drain to chew through it.
  pyre_lich: {
    id: "pyre_lich",
    name: "Pyre Lich",
    icon: "game-icons:death-skull",
    tags: ["fire-immune", "reflect: direct"],
    combatStats: {
      maxHp: 72, currentHp: 72, maxMana: 12, currentMana: 12,
      might: 6, agility: 4, insight: 7, defense: 4, power: 9,
    },
    immune: ["fire"],
    reflect: ["cold", "shock", "arcane", "physical"],
    resistances: { poison: 0.2 },
    weak: ["poison"],
    xpReward: 60,
    crystalReward: 30,
    flavor: "Robed in ash. Its bones remember the sun. Fire only feeds it; direct force only burns the caster.",
    ai: "lich",
  },
};
