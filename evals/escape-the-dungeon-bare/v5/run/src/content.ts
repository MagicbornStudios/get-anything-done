import type {
  Rune,
  Spell,
  Skill,
  Enemy,
  Floor,
  EventDef,
} from "./types";

export const RUNES: Rune[] = [
  { id: "F", letter: "F", name: "Fire", icon: "game-icons:flame", color: "rune-fire", damageType: "fire" },
  { id: "I", letter: "I", name: "Ice", icon: "game-icons:ice-cube", color: "rune-ice", damageType: "ice" },
  { id: "P", letter: "P", name: "Poison", icon: "game-icons:poison-bottle", color: "rune-poison", damageType: "poison" },
  { id: "B", letter: "B", name: "Bolster", icon: "game-icons:embrassed-energy", color: "rune-arcane", damageType: "arcane" },
  { id: "S", letter: "S", name: "Surge", icon: "game-icons:lightning-tear", color: "rune-physical", damageType: "arcane" },
];

// STARTER: only Firebolt — insufficient for resistant/immune enemies
export const STARTER_SPELL_IDS = ["firebolt"];

export const SPELLS: Spell[] = [
  {
    id: "firebolt",
    name: "Firebolt",
    icon: "game-icons:fire-bolt",
    runes: ["F"],
    manaCost: 3,
    description: "A simple bolt of fire. 6 fire damage.",
    power: 6,
    damageType: "fire",
    target: "enemy",
  },
  {
    id: "inferno",
    name: "Inferno",
    icon: "game-icons:fire-silhouette",
    runes: ["F", "F"],
    manaCost: 6,
    description: "Concentrated fire. 12 fire damage.",
    power: 12,
    damageType: "fire",
    target: "enemy",
  },
  {
    id: "frostfire",
    name: "Frostfire",
    icon: "game-icons:icy-flames",
    runes: ["F", "I"],
    manaCost: 5,
    description: "Cold flame. 8 ice damage, slows the foe.",
    power: 8,
    damageType: "ice",
    target: "enemy",
    effects: [{ kind: "slow", turns: 2, magnitude: 1 }],
  },
  {
    id: "venom_shard",
    name: "Venom Shard",
    icon: "game-icons:fragmented-meteor",
    runes: ["I", "P"],
    manaCost: 4,
    description: "5 ice damage + poison DoT (3/turn, 3 turns).",
    power: 5,
    damageType: "ice",
    target: "enemy",
    effects: [{ kind: "dot", turns: 3, magnitude: 3, damageType: "poison" }],
  },
  {
    id: "plague",
    name: "Plague",
    icon: "game-icons:biohazard",
    runes: ["P", "P"],
    manaCost: 5,
    description: "2 poison damage + heavy DoT (4/turn, 4 turns).",
    power: 2,
    damageType: "poison",
    target: "enemy",
    effects: [{ kind: "dot", turns: 4, magnitude: 4, damageType: "poison" }],
  },
  {
    id: "battle_hymn",
    name: "Battle Hymn",
    icon: "game-icons:musical-notes",
    runes: ["B", "S"],
    manaCost: 4,
    description: "Heal 8 HP and empower next 2 attacks (+50% damage).",
    power: 0,
    damageType: "arcane",
    target: "self",
    selfHeal: 8,
    effects: [{ kind: "empower", turns: 2, magnitude: 1.5 }],
  },
  {
    id: "meteor",
    name: "Meteor",
    icon: "game-icons:meteor-impact",
    runes: ["F", "S"],
    manaCost: 8,
    crystalCost: 1,
    description: "Massive 15 fire damage. Costs 1 crystal.",
    power: 15,
    damageType: "fire",
    target: "enemy",
  },
  {
    id: "blizzard",
    name: "Blizzard",
    icon: "game-icons:snow-flake",
    runes: ["I", "I"],
    manaCost: 6,
    description: "10 ice damage, slows enemy.",
    power: 10,
    damageType: "ice",
    target: "enemy",
    effects: [{ kind: "slow", turns: 2, magnitude: 1 }],
  },
  {
    id: "antivenin",
    name: "Antivenin",
    icon: "game-icons:health-potion",
    runes: ["P", "B"],
    manaCost: 3,
    description: "Heal 6 HP and cleanse poisons/slows.",
    power: 0,
    damageType: "arcane",
    target: "self",
    selfHeal: 6,
  },
  {
    id: "arc_surge",
    name: "Arc Surge",
    icon: "game-icons:lightning-branches",
    runes: ["S", "S"],
    manaCost: 5,
    description: "9 arcane damage, ignores physical defense.",
    power: 9,
    damageType: "arcane",
    target: "enemy",
  },
];

// authored spell combinations: join runes sorted → spell id
export const COMBINATIONS: Record<string, string> = {
  "F": "firebolt",
  "FF": "inferno",
  "FI": "frostfire",
  "IP": "venom_shard",
  "PP": "plague",
  "BS": "battle_hymn",
  "FS": "meteor",
  "II": "blizzard",
  "BP": "antivenin",
  "SS": "arc_surge",
};

export const SKILLS: Skill[] = [
  {
    id: "slash",
    name: "Slash",
    icon: "game-icons:broadsword",
    description: "A basic physical strike. No mana cost.",
    power: 4,
    damageType: "physical",
    manaCost: 0,
    crystalOvercharge: {
      crystalCost: 1,
      bonus: 4,
      addEffect: { kind: "dot", turns: 2, magnitude: 2, damageType: "physical" },
    },
  },
];

export const ENEMIES: Enemy[] = [
  // floor 1: physical-resistant catacombs
  {
    id: "slime",
    name: "Ooze",
    icon: "game-icons:slime",
    combatStats: { maxHp: 14, currentHp: 14, maxMana: 0, currentMana: 0, might: 3, agility: 2, insight: 1, willpower: 2, defense: 2, power: 1 },
    resistances: { physical: 0.5, fire: 1.5 },
    xpReward: 8,
    crystalReward: 2,
    ai: "basic",
    notes: "Gelatinous — resistant to slashing.",
  },
  {
    id: "bone_knight",
    name: "Bone Knight",
    icon: "game-icons:skull-shield",
    combatStats: { maxHp: 22, currentHp: 22, maxMana: 0, currentMana: 0, might: 5, agility: 2, insight: 1, willpower: 3, defense: 4, power: 1 },
    resistances: { physical: 0.5, ice: 0.75 },
    xpReward: 12,
    crystalReward: 3,
    ai: "basic",
    notes: "Plate armor turns away steel.",
  },
  {
    id: "stone_warden",
    name: "Stone Warden",
    icon: "game-icons:stone-tower",
    combatStats: { maxHp: 32, currentHp: 32, maxMana: 0, currentMana: 0, might: 6, agility: 1, insight: 1, willpower: 5, defense: 6, power: 1 },
    resistances: { physical: 0.25, fire: 1.0, ice: 1.5, poison: 1.25 },
    xpReward: 20,
    crystalReward: 6,
    ai: "basic",
    notes: "ELITE — petrified hide. Immune to all but magic.",
  },
  {
    id: "fungal_sovereign",
    name: "Fungal Sovereign",
    icon: "game-icons:mushroom-gills",
    combatStats: { maxHp: 42, currentHp: 42, maxMana: 0, currentMana: 0, might: 6, agility: 2, insight: 2, willpower: 5, defense: 3, power: 1 },
    resistances: { fire: 0, physical: 0.75, ice: 1.5, poison: 0.1 },
    xpReward: 40,
    crystalReward: 15,
    ai: "basic",
    notes: "BOSS — immune to fire, weak to ice. Resistant to its own poison.",
  },

  // floor 2: reflect direct damage, embers
  {
    id: "ember_wisp",
    name: "Ember Wisp",
    icon: "game-icons:burning-eye",
    combatStats: { maxHp: 16, currentHp: 16, maxMana: 0, currentMana: 0, might: 4, agility: 4, insight: 1, willpower: 2, defense: 1, power: 1 },
    resistances: { fire: 0, ice: 1.5 },
    xpReward: 10,
    crystalReward: 3,
    ai: "basic",
    notes: "Wreathed in flame — immune to fire.",
  },
  {
    id: "mirror_djinn",
    name: "Mirror Djinn",
    icon: "game-icons:djinn",
    combatStats: { maxHp: 28, currentHp: 28, maxMana: 0, currentMana: 0, might: 5, agility: 3, insight: 3, willpower: 4, defense: 2, power: 2 },
    resistances: { fire: 0.5, ice: 0.5, arcane: 0.25 },
    xpReward: 22,
    crystalReward: 7,
    ai: "reflect",
    reflectPct: 0.4,
    notes: "ELITE — reflects 40% of direct damage. Use DoTs.",
  },
  {
    id: "molten_imp",
    name: "Molten Imp",
    icon: "game-icons:imp",
    combatStats: { maxHp: 18, currentHp: 18, maxMana: 0, currentMana: 0, might: 5, agility: 4, insight: 2, willpower: 2, defense: 2, power: 1 },
    resistances: { fire: 0.5 },
    xpReward: 12,
    crystalReward: 4,
    ai: "basic",
  },
  {
    id: "pyre_lich",
    name: "Pyre Lich",
    icon: "game-icons:evil-wings",
    combatStats: { maxHp: 60, currentHp: 60, maxMana: 0, currentMana: 0, might: 8, agility: 3, insight: 4, willpower: 6, defense: 3, power: 3 },
    resistances: { fire: 0, physical: 0.75, arcane: 0.5 },
    xpReward: 50,
    crystalReward: 25,
    ai: "reflect",
    reflectPct: 0.3,
    notes: "BOSS — immune to fire, reflects 30%. Only DoTs/indirect work well.",
  },
];

// ================= FLOORS =================

export const FLOORS: Floor[] = [
  {
    id: "f1",
    name: "The Damp Catacombs",
    description: "Moss-eaten stone and the slow drip of water. Things here shrug off blade and flame alike.",
    theme: "catacombs",
    mechanicalConstraint: "Enemies resist physical damage. The Fungal Sovereign is immune to fire.",
    startRoomId: "f1_entry",
    bossRoomId: "f1_boss",
    rooms: [
      {
        id: "f1_entry", floorId: "f1", name: "Catacomb Entrance", icon: "game-icons:dungeon-gate", feature: "start",
        description: "A crumbling archway marks the start of your descent. Two paths lead deeper.",
        exits: [
          { to: "f1_combat_a", label: "West — Slime Burrow" },
          { to: "f1_rest", label: "East — Quiet Alcove" },
        ],
      },
      {
        id: "f1_combat_a", floorId: "f1", name: "Slime Burrow", icon: "game-icons:slime", feature: "combat",
        description: "Gelatinous things crawl over bone-dust floors.",
        enemyIds: ["slime", "slime"], respawn: true,
        exits: [
          { to: "f1_entry" },
          { to: "f1_forge", label: "North — Forgeworks" },
        ],
      },
      {
        id: "f1_rest", floorId: "f1", name: "Quiet Alcove", icon: "game-icons:campfire", feature: "rest",
        description: "A forgotten shrine. You can rest here briefly.",
        exits: [
          { to: "f1_entry" },
          { to: "f1_event", label: "South — Crypt Inscription" },
        ],
      },
      {
        id: "f1_forge", floorId: "f1", name: "Forgeworks", icon: "game-icons:anvil", feature: "forge",
        description: "An old rune-anvil still hums with warmth. Here you may craft new spells.",
        exits: [
          { to: "f1_combat_a" },
          { to: "f1_elite", label: "Deeper — Guardian Hall" },
          { to: "f1_combat_b", label: "Side — Bone Crypt" },
        ],
      },
      {
        id: "f1_combat_b", floorId: "f1", name: "Bone Crypt", icon: "game-icons:bone-knife", feature: "combat",
        description: "Armored skeletons stand eternal watch.",
        enemyIds: ["bone_knight"], respawn: true,
        exits: [
          { to: "f1_forge" },
          { to: "f1_boss", label: "North — Sovereign's Grove" },
        ],
      },
      {
        id: "f1_event", floorId: "f1", name: "Crypt Inscription", icon: "game-icons:stone-tablet", feature: "event",
        description: "A slab bears a warning in old script.", eventId: "ev_inscription",
        exits: [
          { to: "f1_rest" },
          { to: "f1_elite", label: "West — Guardian Hall" },
        ],
      },
      {
        id: "f1_elite", floorId: "f1", name: "Guardian Hall", icon: "game-icons:stone-tower", feature: "elite",
        description: "A Stone Warden blocks the way. Its hide turns away all steel.",
        enemyIds: ["stone_warden"],
        exits: [
          { to: "f1_forge" },
          { to: "f1_boss", label: "Deeper — Sovereign's Grove" },
        ],
      },
      {
        id: "f1_boss", floorId: "f1", name: "Sovereign's Grove", icon: "game-icons:mushroom-gills", feature: "boss",
        description: "Monstrous fungi pulse with heat. At the center, the Fungal Sovereign waits, unburnt.",
        enemyIds: ["fungal_sovereign"],
        exits: [
          { to: "f1_combat_b" },
        ],
      },
    ],
  },
  {
    id: "f2",
    name: "The Ember Vault",
    description: "A heat-drowned hall of brass mirrors. Direct strikes are turned back on the striker.",
    theme: "ember",
    mechanicalConstraint: "Elites reflect direct damage — prefer DoTs, indirect, or bursts you can survive.",
    startRoomId: "f2_entry",
    bossRoomId: "f2_boss",
    rooms: [
      {
        id: "f2_entry", floorId: "f2", name: "Ember Threshold", icon: "game-icons:dungeon-gate", feature: "start",
        description: "The air shimmers with heat. Brass walls reflect every motion.",
        exits: [
          { to: "f2_combat_a", label: "West — Imp Warren" },
          { to: "f2_forge", label: "North — Mirror Forge" },
        ],
      },
      {
        id: "f2_combat_a", floorId: "f2", name: "Imp Warren", icon: "game-icons:imp", feature: "combat",
        description: "Molten imps cackle among smoldering rubble.",
        enemyIds: ["molten_imp", "molten_imp"], respawn: true,
        exits: [
          { to: "f2_entry" },
          { to: "f2_rest", label: "North — Ashen Spring" },
        ],
      },
      {
        id: "f2_forge", floorId: "f2", name: "Mirror Forge", icon: "game-icons:anvil", feature: "forge",
        description: "An anvil sealed in glass. You can forge new spells here.",
        exits: [
          { to: "f2_entry" },
          { to: "f2_event", label: "East — Wailing Gallery" },
          { to: "f2_elite", label: "North — Djinn's Chamber" },
        ],
      },
      {
        id: "f2_rest", floorId: "f2", name: "Ashen Spring", icon: "game-icons:campfire", feature: "rest",
        description: "A spring bubbles with grey water. Short rest only.",
        exits: [
          { to: "f2_combat_a" },
          { to: "f2_combat_b", label: "East — Wisp Chorus" },
        ],
      },
      {
        id: "f2_combat_b", floorId: "f2", name: "Wisp Chorus", icon: "game-icons:burning-eye", feature: "combat",
        description: "Ember wisps dance about.",
        enemyIds: ["ember_wisp", "ember_wisp"], respawn: true,
        exits: [
          { to: "f2_rest" },
          { to: "f2_boss", label: "North — Lich's Pyre" },
        ],
      },
      {
        id: "f2_event", floorId: "f2", name: "Wailing Gallery", icon: "game-icons:stone-tablet", feature: "event",
        description: "Mirrors line this hall, each showing a different fate.", eventId: "ev_gallery",
        exits: [
          { to: "f2_forge" },
          { to: "f2_elite", label: "North — Djinn's Chamber" },
        ],
      },
      {
        id: "f2_elite", floorId: "f2", name: "Djinn's Chamber", icon: "game-icons:djinn", feature: "elite",
        description: "The Mirror Djinn observes itself in a thousand shards.",
        enemyIds: ["mirror_djinn"],
        exits: [
          { to: "f2_forge" },
          { to: "f2_boss", label: "North — Lich's Pyre" },
        ],
      },
      {
        id: "f2_boss", floorId: "f2", name: "Lich's Pyre", icon: "game-icons:evil-wings", feature: "boss",
        description: "Black flame roars around the Pyre Lich. Its laughter scatters on bronze walls.",
        enemyIds: ["pyre_lich"],
        exits: [
          { to: "f2_combat_b" },
          { to: "f2_elite" },
        ],
      },
    ],
  },
];

export const EVENTS: EventDef[] = [
  {
    id: "ev_inscription",
    name: "Crypt Inscription",
    text: "The stone reads: 'The Sovereign laughs at fire. Seek other paths.' You trace the old runes with your finger.",
    choices: [
      {
        label: "Study the runes (+10 Insight XP, -2 mana)",
        outcome: "You feel a flicker of understanding.",
        effect: { xp: 10, mana: -2 },
      },
      {
        label: "Pocket the crystal shards (+3 crystals)",
        outcome: "Mana crystals tumble into your pouch.",
        effect: { crystals: 3 },
      },
      {
        label: "Pray for guidance (+4 HP, +1 Awareness)",
        outcome: "A calm settles over you.",
        effect: { hp: 4, trait: { name: "Awareness", delta: 1 } },
      },
    ],
  },
  {
    id: "ev_gallery",
    name: "Wailing Gallery",
    text: "A mirror shows you wielding a spell you have not yet learned. Another shows your corpse. A third offers crystals.",
    choices: [
      {
        label: "Take the crystals (+6 crystals, -3 HP)",
        outcome: "Glass slices your hand as you reach in.",
        effect: { crystals: 6, hp: -3 },
      },
      {
        label: "Meditate on the spell vision (+20 XP)",
        outcome: "The vision burns into memory.",
        effect: { xp: 20 },
      },
      {
        label: "Shatter the mirror of your corpse (+2 Awareness)",
        outcome: "Good riddance.",
        effect: { trait: { name: "Awareness", delta: 2 } },
      },
    ],
  },
];

export const STARTER_TRAITS: Record<string, number> = {
  Comprehension: 2,
  Direction: 1,
  Empathy: 1,
  Freedom: 2,
  Survival: 3,
  Effort: 2,
  Awareness: 2,
  Guile: 1,
  Momentum: 1,
  Fame: 0,
  Equilibrium: 1,
  Projection: 1,
  Levity: 1,
  Constraint: 0,
  Construction: 1,
};
