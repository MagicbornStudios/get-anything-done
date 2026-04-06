import type { EntityDefinition } from "../types";

export const ENTITIES: EntityDefinition[] = [
  // Floor 1 enemies
  {
    entityId: "enemy_cave_spider",
    name: "Cave Spider",
    entityTypeId: "spider",
    occupationId: "hostile",
    combatStats: {
      might: 8, agility: 12, insight: 3, willpower: 4,
      defense: 3, power: 5, currentHp: 25, maxHp: 25,
      currentMana: 0, maxMana: 0,
    },
    level: 1,
    xpReward: 15,
    crystalReward: 5,
  },
  {
    entityId: "enemy_giant_bat",
    name: "Giant Bat",
    entityTypeId: "bat",
    occupationId: "hostile",
    combatStats: {
      might: 6, agility: 15, insight: 5, willpower: 3,
      defense: 2, power: 4, currentHp: 18, maxHp: 18,
      currentMana: 0, maxMana: 0,
    },
    level: 1,
    xpReward: 12,
    crystalReward: 4,
  },
  // Floor 1 boss
  {
    entityId: "boss_stone_golem",
    name: "Stone Golem",
    entityTypeId: "golem",
    occupationId: "boss",
    combatStats: {
      might: 18, agility: 4, insight: 6, willpower: 15,
      defense: 12, power: 10, currentHp: 80, maxHp: 80,
      currentMana: 0, maxMana: 0,
    },
    level: 3,
    xpReward: 50,
    crystalReward: 25,
  },
  // Floor 2 enemies
  {
    entityId: "enemy_slime",
    name: "Acidic Slime",
    entityTypeId: "slime",
    occupationId: "hostile",
    combatStats: {
      might: 5, agility: 3, insight: 2, willpower: 8,
      defense: 6, power: 7, currentHp: 35, maxHp: 35,
      currentMana: 10, maxMana: 10,
    },
    level: 2,
    xpReward: 20,
    crystalReward: 8,
  },
  {
    entityId: "enemy_water_serpent",
    name: "Water Serpent",
    entityTypeId: "serpent",
    occupationId: "hostile",
    combatStats: {
      might: 12, agility: 14, insight: 6, willpower: 5,
      defense: 5, power: 8, currentHp: 30, maxHp: 30,
      currentMana: 0, maxMana: 0,
    },
    level: 2,
    xpReward: 22,
    crystalReward: 9,
  },
  // Floor 2 boss
  {
    entityId: "boss_shadow_wraith",
    name: "Shadow Wraith",
    entityTypeId: "wraith",
    occupationId: "boss",
    combatStats: {
      might: 14, agility: 16, insight: 12, willpower: 18,
      defense: 8, power: 15, currentHp: 100, maxHp: 100,
      currentMana: 50, maxMana: 50,
    },
    level: 5,
    xpReward: 80,
    crystalReward: 40,
  },
  // Floor 3 enemies
  {
    entityId: "enemy_lava_lizard",
    name: "Lava Lizard",
    entityTypeId: "lizard",
    occupationId: "hostile",
    combatStats: {
      might: 14, agility: 10, insight: 4, willpower: 6,
      defense: 8, power: 10, currentHp: 40, maxHp: 40,
      currentMana: 0, maxMana: 0,
    },
    level: 3,
    xpReward: 25,
    crystalReward: 12,
  },
  {
    entityId: "enemy_fire_imp",
    name: "Fire Imp",
    entityTypeId: "imp",
    occupationId: "hostile",
    combatStats: {
      might: 8, agility: 16, insight: 10, willpower: 7,
      defense: 4, power: 14, currentHp: 28, maxHp: 28,
      currentMana: 30, maxMana: 30,
    },
    level: 3,
    xpReward: 28,
    crystalReward: 14,
  },
  // Floor 3 boss
  {
    entityId: "boss_flame_warden",
    name: "Flame Warden",
    entityTypeId: "elemental",
    occupationId: "boss",
    combatStats: {
      might: 20, agility: 10, insight: 14, willpower: 20,
      defense: 10, power: 20, currentHp: 130, maxHp: 130,
      currentMana: 80, maxMana: 80,
    },
    level: 7,
    xpReward: 120,
    crystalReward: 60,
  },
  // NPCs
  {
    entityId: "npc_wanderer_ryn",
    name: "Ryn the Wanderer",
    entityTypeId: "human",
    occupationId: "dungeoneer",
    partyRoleId: "scout",
    combatStats: {
      might: 10, agility: 12, insight: 8, willpower: 8,
      defense: 6, power: 7, currentHp: 40, maxHp: 40,
      currentMana: 20, maxMana: 20,
    },
    level: 3,
    dialogueLines: [
      "Hey there, fellow dungeoneer. Name's Ryn.",
      "This dungeon... it's worse than they say. The boss on each floor gets nastier.",
      "Pro tip: find a Rune Forge. Craft spells. You'll need them.",
      "I've heard the golden crystal can buy your way past the boss. Rare find though.",
      "Good luck. We all need it down here.",
    ],
  },
  {
    entityId: "npc_firekeeper",
    name: "Ember, the Firekeeper",
    entityTypeId: "human",
    occupationId: "dungeoneer",
    partyRoleId: "healer",
    combatStats: {
      might: 6, agility: 7, insight: 14, willpower: 16,
      defense: 5, power: 12, currentHp: 35, maxHp: 35,
      currentMana: 60, maxMana: 60,
    },
    level: 5,
    dialogueLines: [
      "Welcome to my little corner of warmth.",
      "The flames here are old... older than the dungeon itself.",
      "I keep the fires burning so travelers like you can find their way.",
      "The Flame Warden above... it was once a keeper, like me. Consumed by power.",
      "Rest if you need. The fire will watch over you.",
    ],
  },
];
