// Content pack - all game data loaded from this module (simulating JSON content packs)
import type { Enemy, Floor, Item, NPC, Room, Rune, Spell } from "../types";

export const RUNES: Record<string, Rune> = {
  fire: { id: "fire", name: "Fire Rune", element: "fire", icon: "\u{1F525}", color: "#ff4422", description: "A blazing red rune, warm to the touch" },
  ice: { id: "ice", name: "Ice Rune", element: "ice", icon: "\u{2744}\u{FE0F}", color: "#44bbff", description: "A crystalline rune that chills the air" },
  lightning: { id: "lightning", name: "Lightning Rune", element: "lightning", icon: "\u{26A1}", color: "#ffdd00", description: "A crackling rune sparking with energy" },
  earth: { id: "earth", name: "Earth Rune", element: "earth", icon: "\u{1FAA8}", color: "#88aa44", description: "A heavy stone rune, solid and unyielding" },
  shadow: { id: "shadow", name: "Shadow Rune", element: "shadow", icon: "\u{1F311}", color: "#8844aa", description: "A dark rune that absorbs nearby light" },
};

export const SPELLS: Record<string, Spell> = {
  fireball: {
    id: "fireball", name: "Fireball", manaCost: 8, damage: 25, element: "fire",
    description: "Hurls a ball of flame", runeRecipe: ["fire", "fire"], icon: "\u{1F525}", color: "#ff4422"
  },
  frostbolt: {
    id: "frostbolt", name: "Frostbolt", manaCost: 6, damage: 18, element: "ice",
    description: "Launches a shard of ice", runeRecipe: ["ice", "ice"], icon: "\u{2744}\u{FE0F}", color: "#44bbff"
  },
  thunderstrike: {
    id: "thunderstrike", name: "Thunderstrike", manaCost: 10, damage: 30, element: "lightning",
    description: "Calls down a bolt of lightning", runeRecipe: ["fire", "lightning"], icon: "\u{26A1}", color: "#ffdd00"
  },
  avalanche: {
    id: "avalanche", name: "Avalanche", manaCost: 12, damage: 22, element: "earth",
    description: "Buries the foe in frozen rubble", runeRecipe: ["ice", "earth"], icon: "\u{1F4A0}", color: "#66ccaa"
  },
  void_bolt: {
    id: "void_bolt", name: "Void Bolt", manaCost: 14, damage: 35, element: "shadow",
    description: "A bolt of pure darkness", runeRecipe: ["shadow", "lightning"], icon: "\u{1F31F}", color: "#aa44ff"
  },
  magma_shield: {
    id: "magma_shield", name: "Magma Shield", manaCost: 9, damage: 15, element: "fire",
    description: "Erupts molten rock as defense", runeRecipe: ["fire", "earth"], icon: "\u{1F30B}", color: "#ff6633"
  },
  blizzard: {
    id: "blizzard", name: "Blizzard", manaCost: 11, damage: 28, element: "ice",
    description: "Engulfs the area in freezing winds", runeRecipe: ["ice", "lightning"], icon: "\u{1F328}\u{FE0F}", color: "#88ddff"
  },
  shadow_step: {
    id: "shadow_step", name: "Shadow Step", manaCost: 7, damage: 20, element: "shadow",
    description: "Strike from the shadows", runeRecipe: ["shadow", "earth"], icon: "\u{1F47E}", color: "#664488"
  },
  dark_flame: {
    id: "dark_flame", name: "Dark Flame", manaCost: 13, damage: 32, element: "shadow",
    description: "Unholy fire that consumes all", runeRecipe: ["shadow", "fire"], icon: "\u{1F480}", color: "#993366"
  },
  frozen_shadow: {
    id: "frozen_shadow", name: "Frozen Shadow", manaCost: 10, damage: 24, element: "shadow",
    description: "Freezing darkness envelops the foe", runeRecipe: ["shadow", "ice"], icon: "\u{1F30C}", color: "#6644aa"
  },
};

export const ENEMIES: Record<string, Enemy> = {
  slime: {
    id: "slime", name: "Dungeon Slime",
    stats: { currentHp: 30, maxHp: 30, currentMana: 0, maxMana: 0, might: 5, agility: 3, defense: 2, power: 0, insight: 0, willpower: 0 },
    xpReward: 15, crystalReward: 5, spriteColor: "#44cc44", description: "A gelatinous blob that oozes malice"
  },
  skeleton: {
    id: "skeleton", name: "Bone Rattler",
    stats: { currentHp: 45, maxHp: 45, currentMana: 0, maxMana: 0, might: 8, agility: 6, defense: 4, power: 0, insight: 0, willpower: 0 },
    xpReward: 25, crystalReward: 10, spriteColor: "#ccccaa", description: "A reanimated skeleton wielding a rusty sword"
  },
  dark_mage: {
    id: "dark_mage", name: "Shadow Caster",
    stats: { currentHp: 35, maxHp: 35, currentMana: 20, maxMana: 20, might: 4, agility: 5, defense: 3, power: 12, insight: 8, willpower: 6 },
    xpReward: 40, crystalReward: 20, spriteColor: "#8844aa", description: "A dark mage channeling forbidden spells"
  },
  boss_golem: {
    id: "boss_golem", name: "Stone Golem",
    stats: { currentHp: 100, maxHp: 100, currentMana: 0, maxMana: 0, might: 15, agility: 2, defense: 10, power: 5, insight: 0, willpower: 8 },
    xpReward: 80, crystalReward: 50, spriteColor: "#887766", description: "A massive golem guarding the floor exit"
  },
};

export const ITEMS: Record<string, Item> = {
  health_potion: { id: "health_potion", name: "Health Potion", type: "potion", effect: "heal_hp", value: 30, icon: "\u{2764}\u{FE0F}", description: "Restores 30 HP" },
  mana_potion: { id: "mana_potion", name: "Mana Potion", type: "potion", effect: "heal_mana", value: 20, icon: "\u{1F499}", description: "Restores 20 Mana" },
  scroll_might: { id: "scroll_might", name: "Scroll of Might", type: "scroll", effect: "buff_might", value: 3, icon: "\u{1F4DC}", description: "Increases Might by 3 for this combat" },
};

export const NPCS: Record<string, NPC> = {
  old_sage: {
    id: "old_sage", name: "Elder Mystic", portraitColor: "#4488cc",
    dialogue: [
      {
        text: "Greetings, adventurer. The dungeon grows more dangerous with each floor. I can offer guidance... or perhaps something more tangible.",
        choices: [
          { text: "Tell me about this place", nextIndex: 1 },
          { text: "Do you have anything useful?", nextIndex: 2 },
          { text: "I'll be on my way", nextIndex: 3 },
        ]
      },
      {
        text: "This dungeon was once a wizard's tower, inverted by dark magic. The Rune Forge on each floor lets you combine runes into powerful spells. Seek it out!",
        choices: [
          { text: "Thank you for the wisdom", nextIndex: 3, effect: { type: "give_xp", amount: 10 } },
        ]
      },
      {
        text: "Take this rune. Combine it with another at the Forge to create something powerful.",
        choices: [
          { text: "Accept the Fire Rune", nextIndex: 3, effect: { type: "give_rune", runeId: "fire" } },
          { text: "Accept the Ice Rune", nextIndex: 3, effect: { type: "give_rune", runeId: "ice" } },
        ]
      },
      {
        text: "May the runes guide your path. Farewell, adventurer.",
        choices: []
      },
    ]
  },
  merchant: {
    id: "merchant", name: "Wandering Merchant", portraitColor: "#cc8844",
    dialogue: [
      {
        text: "Psst! Over here. I've got wares that might interest a dungeon crawler like yourself.",
        choices: [
          { text: "What do you have?", nextIndex: 1 },
          { text: "No thanks", nextIndex: 2 },
        ]
      },
      {
        text: "Here, take this healing potion. First one's free - you'll need it down there.",
        choices: [
          { text: "Take the potion", nextIndex: 2, effect: { type: "give_item", itemId: "health_potion" } },
        ]
      },
      {
        text: "Good luck down there!",
        choices: []
      },
    ]
  },
};

export function createFloor(floorNum: number): Floor {
  const rooms: Record<string, Room> = {};
  const f = `f${floorNum}`;

  // Create a dungeon floor layout
  rooms[`${f}_entrance`] = {
    id: `${f}_entrance`, name: "Entrance Hall", description: "A dimly lit chamber. Torches flicker on the walls.",
    type: "rest", exits: { north: `${f}_corridor`, east: `${f}_alcove` },
    discovered: true, visited: false, cleared: false,
  };
  rooms[`${f}_corridor`] = {
    id: `${f}_corridor`, name: "Dark Corridor", description: "A narrow passage. You hear scratching sounds ahead.",
    type: "combat", exits: { south: `${f}_entrance`, north: `${f}_forge`, east: `${f}_library` },
    discovered: false, visited: false, cleared: false, enemyId: "slime",
  };
  rooms[`${f}_alcove`] = {
    id: `${f}_alcove`, name: "Hidden Alcove", description: "A small nook with ancient carvings on the walls.",
    type: "treasure", exits: { west: `${f}_entrance`, north: `${f}_library` },
    discovered: false, visited: false, cleared: false,
    loot: ["health_potion"],
  };
  rooms[`${f}_forge`] = {
    id: `${f}_forge`, name: "Rune Forge", description: "Ancient rune circles glow on the floor. A mystical anvil pulses with energy.",
    type: "forge", exits: { south: `${f}_corridor`, east: `${f}_sanctum` },
    discovered: false, visited: false, cleared: false,
  };
  rooms[`${f}_library`] = {
    id: `${f}_library`, name: "Ruined Library", description: "Dusty tomes and broken shelves. An old figure sits among the books.",
    type: "dialogue", exits: { west: `${f}_corridor`, south: `${f}_alcove`, north: `${f}_sanctum` },
    discovered: false, visited: false, cleared: false,
    npcId: floorNum === 1 ? "old_sage" : "merchant",
  };
  rooms[`${f}_sanctum`] = {
    id: `${f}_sanctum`, name: "Guard Chamber", description: "A large chamber with claw marks on the walls. Something lurks here.",
    type: "combat", exits: { west: `${f}_forge`, south: `${f}_library`, north: `${f}_boss` },
    discovered: false, visited: false, cleared: false, enemyId: "skeleton",
  };
  rooms[`${f}_boss`] = {
    id: `${f}_boss`, name: "Boss Chamber", description: "An enormous chamber. The floor trembles with each step of the guardian within.",
    type: "boss", exits: { south: `${f}_sanctum` },
    discovered: true, visited: false, cleared: false, enemyId: "boss_golem",
  };

  return { id: floorNum, rooms, startRoomId: `${f}_entrance` };
}

// Import as JSON content pack format
export const CONTENT_PACK = {
  runes: RUNES,
  spells: SPELLS,
  enemies: ENEMIES,
  items: ITEMS,
  npcs: NPCS,
};

