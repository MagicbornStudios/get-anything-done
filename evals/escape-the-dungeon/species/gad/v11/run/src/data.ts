// ============================================================
// Authored dungeon content — floors, rooms, enemies, NPCs, items
// ============================================================

import type { Floor, Room, Enemy, NPC, Rune, Spell, PhysicalSkill, Item, ActionPolicy, Traits, Element } from './types';

// ---- Default traits ----
export const defaultTraits = (): Traits => ({
  aggression: 0.3,
  compassion: 0.5,
  cunning: 0.3,
  resilience: 0.4,
  arcaneAffinity: 0.2,
});

// ---- RUNES ----
export const ALL_RUNES: Rune[] = [
  {
    id: 'rune-fire', name: 'Ignis Rune', element: 'fire',
    icon: 'game-icons:fire-ring', description: 'A warm rune pulsing with flame.',
    discovered: true, affinityLevel: 0,
    affinityMilestones: [
      { level: 20, reward: 'Fire spells +10% damage', claimed: false },
      { level: 50, reward: 'Unlock Inferno variant', claimed: false },
      { level: 80, reward: 'Fire spells apply Burn DoT', claimed: false },
    ],
  },
  {
    id: 'rune-ice', name: 'Glacius Rune', element: 'ice',
    icon: 'game-icons:ice-cube', description: 'A cold rune shimmering with frost.',
    discovered: true, affinityLevel: 0,
    affinityMilestones: [
      { level: 20, reward: 'Ice spells +10% damage', claimed: false },
      { level: 50, reward: 'Unlock Blizzard variant', claimed: false },
      { level: 80, reward: 'Ice spells apply Slow', claimed: false },
    ],
  },
  {
    id: 'rune-nature', name: 'Verdant Rune', element: 'nature',
    icon: 'game-icons:oak-leaf', description: 'A rune thrumming with life energy.',
    discovered: false, affinityLevel: 0,
    affinityMilestones: [
      { level: 20, reward: 'Nature heals +15%', claimed: false },
      { level: 50, reward: 'Unlock Thornwall variant', claimed: false },
      { level: 80, reward: 'Nature spells leech HP', claimed: false },
    ],
  },
  {
    id: 'rune-shadow', name: 'Umbra Rune', element: 'shadow',
    icon: 'game-icons:death-skull', description: 'A dark rune whispering secrets.',
    discovered: false, affinityLevel: 0,
    affinityMilestones: [
      { level: 20, reward: 'Shadow spells +10% damage', claimed: false },
      { level: 50, reward: 'Unlock Void Strike variant', claimed: false },
      { level: 80, reward: 'Shadow spells drain mana', claimed: false },
    ],
  },
  {
    id: 'rune-arcane', name: 'Aether Rune', element: 'arcane',
    icon: 'game-icons:crystal-ball', description: 'A rune of pure magical essence.',
    discovered: false, affinityLevel: 0,
    affinityMilestones: [
      { level: 20, reward: 'All spell costs -5%', claimed: false },
      { level: 50, reward: 'Unlock Arcane Surge variant', claimed: false },
      { level: 80, reward: 'Spells have chance to refund mana', claimed: false },
    ],
  },
];

// ---- STARTER SPELLS ----
export const STARTER_SPELLS: Spell[] = [
  {
    id: 'spell-ember', name: 'Ember Bolt', elements: ['fire'], runeIds: ['rune-fire'],
    power: 12, manaCost: 8, tier: 1, icon: 'game-icons:fire-bolt',
    ingredients: ['rune-fire'],
    effects: [{ type: 'damage', element: 'fire', value: 12, description: 'Deals fire damage' }],
  },
  {
    id: 'spell-frost', name: 'Frost Shard', elements: ['ice'], runeIds: ['rune-ice'],
    power: 10, manaCost: 7, tier: 1, icon: 'game-icons:ice-bolt',
    ingredients: ['rune-ice'],
    effects: [{ type: 'damage', element: 'ice', value: 10, description: 'Deals ice damage' }],
  },
];

// ---- PHYSICAL SKILLS ----
export const ALL_SKILLS: PhysicalSkill[] = [
  {
    id: 'skill-strike', name: 'Power Strike', staminaCost: 10, damage: 15,
    icon: 'game-icons:sword-brandish', unlocked: true, tier: 1, prerequisites: [],
    effects: [{ type: 'damage', value: 15, description: 'A strong physical attack' }],
  },
  {
    id: 'skill-guard', name: 'Guard Stance', staminaCost: 8, damage: 0,
    icon: 'game-icons:shield-reflect', unlocked: true, tier: 1, prerequisites: [],
    effects: [{ type: 'buff', value: 5, duration: 2, description: 'Raises defense for 2 turns' }],
  },
  {
    id: 'skill-bash', name: 'Shield Bash', staminaCost: 15, damage: 10,
    icon: 'game-icons:shield-bash', unlocked: false, tier: 2, prerequisites: ['skill-guard'],
    effects: [
      { type: 'damage', value: 10, description: 'Bash with shield' },
      { type: 'status', value: 1, duration: 1, description: 'Stun target for 1 turn' },
    ],
  },
  {
    id: 'skill-whirlwind', name: 'Whirlwind', staminaCost: 20, damage: 8,
    icon: 'game-icons:spinning-sword', unlocked: false, tier: 2, prerequisites: ['skill-strike'],
    effects: [{ type: 'damage', value: 8, description: 'Hit all enemies' }],
  },
  {
    id: 'skill-execute', name: 'Execute', staminaCost: 25, damage: 30,
    icon: 'game-icons:decapitation', unlocked: false, tier: 3, prerequisites: ['skill-bash', 'skill-whirlwind'],
    effects: [{ type: 'damage', value: 30, description: 'Massive damage to low-HP target (x2 if below 30%)' }],
  },
  {
    id: 'skill-rally', name: 'Rally Cry', staminaCost: 12, damage: 0,
    icon: 'game-icons:rally-the-troops', unlocked: false, tier: 2, prerequisites: ['skill-strike'],
    effects: [{ type: 'buff', value: 3, duration: 3, description: 'Boost attack for 3 turns' }],
  },
];

// ---- ITEMS ----
export const ALL_ITEMS: Item[] = [
  { id: 'item-hp-potion', name: 'Health Potion', category: 'consumable', icon: 'game-icons:health-potion', description: 'Restores 30 HP', quantity: 1, value: 15 },
  { id: 'item-mana-potion', name: 'Mana Potion', category: 'consumable', icon: 'game-icons:potion-ball', description: 'Restores 20 Mana', quantity: 1, value: 12 },
  { id: 'item-stamina-potion', name: 'Stamina Tonic', category: 'consumable', icon: 'game-icons:brandy-bottle', description: 'Restores 20 Stamina', quantity: 1, value: 10 },
  { id: 'item-iron-sword', name: 'Iron Sword', category: 'equipment', equipSlot: 'main-hand', icon: 'game-icons:broadsword', description: 'A sturdy iron blade. +5 Attack', quantity: 1, value: 30, statBonuses: { attack: 5 } },
  { id: 'item-oak-shield', name: 'Oak Shield', category: 'equipment', equipSlot: 'off-hand', icon: 'game-icons:round-shield', description: 'A wooden shield. +3 Defense', quantity: 1, value: 25, statBonuses: { defense: 3 } },
  { id: 'item-leather-armor', name: 'Leather Armor', category: 'equipment', equipSlot: 'body', icon: 'game-icons:leather-armor', description: 'Basic protection. +4 Defense', quantity: 1, value: 35, statBonuses: { defense: 4 } },
  { id: 'item-focus-gem', name: 'Focus Gem', category: 'equipment', equipSlot: 'trinket', icon: 'game-icons:gem-pendant', description: 'Boosts spell power. +3 Attack, +10 Max Mana', quantity: 1, value: 40, statBonuses: { attack: 3, maxMana: 10 } },
  { id: 'item-fire-ring', name: 'Ring of Embers', category: 'equipment', equipSlot: 'trinket', icon: 'game-icons:fire-ring', description: 'Fire spells deal +15% damage', quantity: 1, value: 50, element: 'fire' },
  { id: 'item-steel-sword', name: 'Steel Longsword', category: 'equipment', equipSlot: 'main-hand', icon: 'game-icons:sword-in-stone', description: 'A fine blade. +8 Attack', quantity: 1, value: 60, statBonuses: { attack: 8 } },
  { id: 'item-chain-mail', name: 'Chain Mail', category: 'equipment', equipSlot: 'body', icon: 'game-icons:chain-mail', description: 'Better protection. +7 Defense', quantity: 1, value: 55, statBonuses: { defense: 7 } },
  { id: 'item-crystal-key', name: 'Crystal Key', category: 'consumable', icon: 'game-icons:key', description: 'Opens the sealed door on Floor 2', quantity: 1, value: 0 },
  { id: 'item-antidote', name: 'Antidote', category: 'consumable', icon: 'game-icons:drink-me', description: 'Cures poison status', quantity: 1, value: 8 },
];

function cloneItem(id: string, qty: number = 1): Item {
  const base = ALL_ITEMS.find(i => i.id === id)!;
  return { ...base, quantity: qty };
}

// ---- ENEMIES ----
function makeEnemy(overrides: Partial<Enemy> & { id: string; name: string }): Enemy {
  return {
    icon: 'game-icons:goblin-face',
    stats: { hp: 30, maxHp: 30, mana: 10, maxMana: 10, stamina: 10, maxStamina: 10, attack: 8, defense: 3, speed: 5, level: 1, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.5, compassion: 0.1, cunning: 0.3, resilience: 0.3, arcaneAffinity: 0.1 },
    loot: [],
    resistances: {},
    weaknesses: {},
    actionPolicies: [{ id: 'ap-1', condition: 'always', action: 'attack', priority: 10 }],
    xpReward: 15,
    goldReward: 5,
    spells: [],
    description: '',
    ...overrides,
  };
}

// Floor 1 enemies — resistant to raw physical, weak to fire/ice (teaches crafting)
const f1Enemies = {
  slime: makeEnemy({
    id: 'enemy-slime', name: 'Stone Slime', icon: 'game-icons:slime',
    description: 'A gelatinous creature with hardened mineral skin. Physical attacks slide off.',
    stats: { hp: 35, maxHp: 35, mana: 0, maxMana: 0, stamina: 15, maxStamina: 15, attack: 7, defense: 8, speed: 3, level: 1, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.4, compassion: 0, cunning: 0.1, resilience: 0.8, arcaneAffinity: 0 },
    resistances: { nature: 0.5 },
    weaknesses: { fire: 1.5, ice: 1.3 },
    loot: [{ itemId: 'item-hp-potion', chance: 0.3 }],
    xpReward: 12, goldReward: 4,
  }),
  rat: makeEnemy({
    id: 'enemy-rat', name: 'Dungeon Rat', icon: 'game-icons:rat',
    description: 'Quick and vicious. Attacks in flurries.',
    stats: { hp: 20, maxHp: 20, mana: 0, maxMana: 0, stamina: 20, maxStamina: 20, attack: 10, defense: 2, speed: 8, level: 1, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.8, compassion: 0, cunning: 0.6, resilience: 0.2, arcaneAffinity: 0 },
    weaknesses: { fire: 1.4 },
    loot: [{ itemId: 'item-stamina-potion', chance: 0.2 }],
    xpReward: 8, goldReward: 3,
    actionPolicies: [
      { id: 'ap-flee', condition: 'hp_below_20', action: 'flee', priority: 1 },
      { id: 'ap-atk', condition: 'always', action: 'attack', priority: 10 },
    ],
  }),
  skeleton: makeEnemy({
    id: 'enemy-skeleton', name: 'Armored Skeleton', icon: 'game-icons:skeleton',
    description: 'Undead warrior in rusted plate. Resistant to physical damage.',
    stats: { hp: 45, maxHp: 45, mana: 0, maxMana: 0, stamina: 10, maxStamina: 10, attack: 12, defense: 10, speed: 4, level: 2, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.6, compassion: 0, cunning: 0.2, resilience: 0.7, arcaneAffinity: 0 },
    resistances: { shadow: 0.3 },
    weaknesses: { fire: 1.5, nature: 1.3 },
    loot: [{ itemId: 'item-iron-sword', chance: 0.15 }, { itemId: 'item-hp-potion', chance: 0.25 }],
    xpReward: 20, goldReward: 8,
  }),
  eliteGolem: makeEnemy({
    id: 'enemy-golem', name: 'Crystal Golem', icon: 'game-icons:rock-golem',
    description: 'A massive construct of living crystal. Physical attacks barely scratch it. Must use elemental damage.',
    stats: { hp: 80, maxHp: 80, mana: 20, maxMana: 20, stamina: 30, maxStamina: 30, attack: 15, defense: 15, speed: 2, level: 3, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.3, compassion: 0, cunning: 0.1, resilience: 0.95, arcaneAffinity: 0.3 },
    resistances: {},
    weaknesses: { fire: 1.8, ice: 1.6 },
    loot: [{ itemId: 'rune-nature', chance: 0.5 }, { itemId: 'item-focus-gem', chance: 0.3 }],
    xpReward: 40, goldReward: 20,
    spells: [{ id: 'golem-slam', name: 'Crystal Slam', elements: ['arcane'], runeIds: [], power: 18, manaCost: 10, tier: 1, icon: 'game-icons:rock', ingredients: [], effects: [{ type: 'damage', value: 18, description: 'Slams with crystal fists' }] }],
    actionPolicies: [
      { id: 'ap-spell', condition: 'has_mana', action: 'golem-slam', priority: 3 },
      { id: 'ap-atk', condition: 'always', action: 'attack', priority: 10 },
    ],
  }),
};

// Floor 1 Boss
const f1Boss = makeEnemy({
  id: 'enemy-warden', name: 'The Warden', icon: 'game-icons:crowned-skull',
  description: 'Guardian of the first gate. Reflects direct damage — use DoT or status effects.',
  stats: { hp: 120, maxHp: 120, mana: 40, maxMana: 40, stamina: 20, maxStamina: 20, attack: 18, defense: 12, speed: 5, level: 4, xp: 0, xpToLevel: 100 },
  traits: { aggression: 0.7, compassion: 0.1, cunning: 0.5, resilience: 0.8, arcaneAffinity: 0.4 },
  resistances: { fire: 0.7, ice: 0.7 },
  weaknesses: { shadow: 1.5, nature: 1.3 },
  loot: [{ itemId: 'rune-shadow', chance: 1.0 }, { itemId: 'item-steel-sword', chance: 0.5 }],
  xpReward: 80, goldReward: 40,
  spells: [
    { id: 'warden-bolt', name: 'Warden\'s Bolt', elements: ['arcane'], runeIds: [], power: 20, manaCost: 12, tier: 2, icon: 'game-icons:lightning-bolt', ingredients: [], effects: [{ type: 'damage', element: 'arcane', value: 20, description: 'Arcane bolt' }] },
  ],
  actionPolicies: [
    { id: 'ap-heal', condition: 'hp_below_30', action: 'heal', priority: 1 },
    { id: 'ap-spell', condition: 'has_mana', action: 'warden-bolt', priority: 3 },
    { id: 'ap-atk', condition: 'always', action: 'attack', priority: 10 },
  ],
});

// Floor 2 enemies — reflect direct damage, need indirect/shadow/nature
const f2Enemies = {
  wraith: makeEnemy({
    id: 'enemy-wraith', name: 'Mana Wraith', icon: 'game-icons:spectre',
    description: 'An ethereal being that drains mana on contact. Shadow-resistant.',
    stats: { hp: 40, maxHp: 40, mana: 30, maxMana: 30, stamina: 5, maxStamina: 5, attack: 14, defense: 4, speed: 7, level: 3, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.6, compassion: 0, cunning: 0.7, resilience: 0.3, arcaneAffinity: 0.8 },
    resistances: { shadow: 0.3, ice: 0.5 },
    weaknesses: { fire: 1.4, nature: 1.6 },
    loot: [{ itemId: 'item-mana-potion', chance: 0.4 }],
    xpReward: 22, goldReward: 10,
    spells: [{ id: 'wraith-drain', name: 'Mana Drain', elements: ['shadow'], runeIds: [], power: 8, manaCost: 5, tier: 1, icon: 'game-icons:magic-swirl', ingredients: [], effects: [{ type: 'damage', element: 'shadow', value: 8, description: 'Drains mana' }, { type: 'debuff', value: -10, description: 'Reduces target mana by 10' }] }],
    actionPolicies: [
      { id: 'ap-drain', condition: 'has_mana', action: 'wraith-drain', priority: 2 },
      { id: 'ap-atk', condition: 'always', action: 'attack', priority: 10 },
    ],
  }),
  gargoyle: makeEnemy({
    id: 'enemy-gargoyle', name: 'Stone Gargoyle', icon: 'game-icons:gargoyle',
    description: 'Animated stone. Extremely tough, but slow. Weak to nature magic.',
    stats: { hp: 60, maxHp: 60, mana: 0, maxMana: 0, stamina: 15, maxStamina: 15, attack: 16, defense: 14, speed: 2, level: 3, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.5, compassion: 0, cunning: 0.1, resilience: 0.9, arcaneAffinity: 0 },
    resistances: { fire: 0.5, ice: 0.5 },
    weaknesses: { nature: 2.0, shadow: 1.3 },
    loot: [{ itemId: 'item-chain-mail', chance: 0.2 }],
    xpReward: 28, goldReward: 12,
  }),
  cultist: makeEnemy({
    id: 'enemy-cultist', name: 'Shadow Cultist', icon: 'game-icons:hooded-figure',
    description: 'A dark spellcaster who punishes spell repetition with counter-magic.',
    stats: { hp: 35, maxHp: 35, mana: 40, maxMana: 40, stamina: 5, maxStamina: 5, attack: 8, defense: 5, speed: 6, level: 3, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.4, compassion: 0.1, cunning: 0.8, resilience: 0.2, arcaneAffinity: 0.7 },
    resistances: { shadow: 0.3, arcane: 0.5 },
    weaknesses: { fire: 1.5, nature: 1.3 },
    loot: [{ itemId: 'rune-arcane', chance: 0.3 }],
    xpReward: 25, goldReward: 15,
    spells: [{ id: 'cultist-curse', name: 'Shadow Curse', elements: ['shadow'], runeIds: [], power: 14, manaCost: 8, tier: 1, icon: 'game-icons:cursed-star', ingredients: [], effects: [{ type: 'damage', element: 'shadow', value: 14, description: 'Curses the target' }, { type: 'debuff', value: -2, duration: 3, description: 'Reduces defense' }] }],
    actionPolicies: [
      { id: 'ap-curse', condition: 'has_mana', action: 'cultist-curse', priority: 2 },
      { id: 'ap-atk', condition: 'always', action: 'attack', priority: 10 },
    ],
  }),
  eliteMirror: makeEnemy({
    id: 'enemy-mirror', name: 'Mirror Knight', icon: 'game-icons:mirror-mirror',
    description: 'Reflects all direct damage back at the attacker. Must use DoT, debuffs, or indirect spells.',
    stats: { hp: 90, maxHp: 90, mana: 0, maxMana: 0, stamina: 25, maxStamina: 25, attack: 20, defense: 10, speed: 5, level: 4, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.7, compassion: 0, cunning: 0.4, resilience: 0.8, arcaneAffinity: 0.2 },
    resistances: { arcane: 0.5 },
    weaknesses: { nature: 1.4, shadow: 1.6 },
    loot: [{ itemId: 'item-fire-ring', chance: 0.4 }],
    xpReward: 50, goldReward: 25,
    actionPolicies: [
      { id: 'ap-reflect', condition: 'attacked', action: 'reflect', priority: 1 },
      { id: 'ap-atk', condition: 'always', action: 'attack', priority: 10 },
    ],
  }),
};

// Floor 2 Boss
const f2Boss = makeEnemy({
  id: 'enemy-lich', name: 'The Lich Archon', icon: 'game-icons:lich-king',
  description: 'Master of shadow and arcane. Mana-drain aura forces physical + nature strategy.',
  stats: { hp: 180, maxHp: 180, mana: 80, maxMana: 80, stamina: 10, maxStamina: 10, attack: 22, defense: 10, speed: 6, level: 5, xp: 0, xpToLevel: 100 },
  traits: { aggression: 0.6, compassion: 0, cunning: 0.9, resilience: 0.5, arcaneAffinity: 0.95 },
  resistances: { shadow: 0.2, arcane: 0.3, ice: 0.5 },
  weaknesses: { fire: 1.4, nature: 1.8 },
  loot: [{ itemId: 'rune-arcane', chance: 1.0 }],
  xpReward: 120, goldReward: 60,
  spells: [
    { id: 'lich-drain', name: 'Soul Drain', elements: ['shadow'], runeIds: [], power: 25, manaCost: 15, tier: 2, icon: 'game-icons:vampire-dracula', ingredients: [], effects: [{ type: 'damage', element: 'shadow', value: 25, description: 'Drains life force' }, { type: 'heal', value: 12, description: 'Lich heals' }] },
    { id: 'lich-nova', name: 'Arcane Nova', elements: ['arcane'], runeIds: [], power: 30, manaCost: 20, tier: 2, icon: 'game-icons:magic-portal', ingredients: [], effects: [{ type: 'damage', element: 'arcane', value: 30, description: 'Arcane explosion' }] },
  ],
  actionPolicies: [
    { id: 'ap-drain', condition: 'hp_below_50', action: 'lich-drain', priority: 1 },
    { id: 'ap-nova', condition: 'has_mana', action: 'lich-nova', priority: 3 },
    { id: 'ap-atk', condition: 'always', action: 'attack', priority: 10 },
  ],
});

// ---- NPCs ----
export const ALL_NPCS: NPC[] = [
  {
    id: 'npc-sage', name: 'Old Sage Miren', icon: 'game-icons:wizard-face',
    portrait: 'game-icons:wizard-face',
    traits: { aggression: 0.1, compassion: 0.8, cunning: 0.6, resilience: 0.3, arcaneAffinity: 0.7 },
    dialogue: [
      {
        id: 'sage-1', text: 'Ah, another soul trapped in these depths. I sense potential in you. The creatures here feed on brute force — you must learn to craft if you wish to escape.',
        choices: [
          { text: 'Teach me about crafting.', nextNodeId: 'sage-2', effects: [{ type: 'trait', traitKey: 'arcaneAffinity', value: 0.05 }] },
          { text: 'I don\'t need help from an old fool.', nextNodeId: 'sage-3', effects: [{ type: 'trait', traitKey: 'aggression', value: 0.1 }, { type: 'trait', traitKey: 'compassion', value: -0.1 }] },
          { text: 'What can you give me?', nextNodeId: 'sage-4', effects: [{ type: 'trait', traitKey: 'cunning', value: 0.05 }] },
        ],
      },
      {
        id: 'sage-2', text: 'The Forge rooms hold ancient power. Combine runes to create spells that exploit enemy weaknesses. The Crystal Golem on this floor is nearly immune to physical attacks — only elemental magic will pierce it.',
        choices: [
          { text: 'Thank you, Sage.', effects: [{ type: 'rune', id: 'rune-nature' }, { type: 'trait', traitKey: 'compassion', value: 0.05 }] },
        ],
      },
      {
        id: 'sage-3', text: 'Hmph. Pride has been the downfall of many before you. But take this — you\'ll need it whether you admit it or not.',
        choices: [
          { text: 'Fine, I\'ll take it.', effects: [{ type: 'item', id: 'item-hp-potion' }] },
        ],
      },
      {
        id: 'sage-4', text: 'A pragmatist, I see. Here — a Verdant Rune I found in the eastern passage. And a word of advice: the Warden at the floor\'s end resists fire and ice. You\'ll need shadow or nature to bring it down.',
        choices: [
          { text: 'Useful. Thanks.', effects: [{ type: 'rune', id: 'rune-nature' }, { type: 'gold', value: 10 }] },
        ],
      },
    ],
  },
  {
    id: 'npc-thief', name: 'Kira the Shadow', icon: 'game-icons:hooded-assassin',
    portrait: 'game-icons:hooded-assassin',
    traits: { aggression: 0.4, compassion: 0.2, cunning: 0.9, resilience: 0.4, arcaneAffinity: 0.3 },
    dialogue: [
      {
        id: 'thief-1', text: 'Psst! Over here. I know a shortcut past the Gargoyles... for a price. Or we could make a deal — I have an Umbra Rune.',
        choices: [
          { text: 'How much for the shortcut? (20 gold)', nextNodeId: 'thief-2', effects: [{ type: 'gold', value: -20 }], traitRequirement: undefined },
          { text: 'I\'ll take the Umbra Rune. What\'s your price?', nextNodeId: 'thief-3', effects: [] },
          { text: 'I don\'t deal with thieves.', nextNodeId: 'thief-4', effects: [{ type: 'trait', traitKey: 'aggression', value: 0.1 }] },
          { text: '[Cunning > 0.5] I see through your act. Give me both.', nextNodeId: 'thief-5', effects: [], traitRequirement: { trait: 'cunning', minValue: 0.5 } },
        ],
      },
      {
        id: 'thief-2', text: 'Pleasure doing business. The gargoyles in the west wing are dormant between clock-hours 6 and 12. Sneak through then.',
        choices: [{ text: 'Got it.', effects: [{ type: 'quest_flag', id: 'gargoyle_shortcut' }] }],
      },
      {
        id: 'thief-3', text: 'Thirty gold and it\'s yours. Shadow magic is rare down here — the Lich Archon on Floor 2 despises it. That makes it... valuable.',
        choices: [
          { text: 'Deal. (30 gold)', effects: [{ type: 'gold', value: -30 }, { type: 'rune', id: 'rune-shadow' }] },
          { text: 'Too rich for me.', effects: [] },
        ],
      },
      {
        id: 'thief-4', text: 'Your loss, hero. Don\'t come crying when the Mirror Knight reflects your spells back at you.',
        choices: [{ text: 'Leave.', effects: [] }],
      },
      {
        id: 'thief-5', text: 'Ha! Clever one. Fine — take the rune and the information. Consider it an investment.',
        choices: [{ text: 'Thanks.', effects: [{ type: 'rune', id: 'rune-shadow' }, { type: 'quest_flag', id: 'gargoyle_shortcut' }, { type: 'trait', traitKey: 'cunning', value: 0.1 }] }],
      },
    ],
  },
  {
    id: 'npc-prisoner', name: 'Galen the Freed', icon: 'game-icons:prisoner',
    portrait: 'game-icons:prisoner',
    traits: { aggression: 0.2, compassion: 0.7, cunning: 0.3, resilience: 0.6, arcaneAffinity: 0.1 },
    dialogue: [
      {
        id: 'prisoner-1', text: 'You... you freed me from that cell. I\'ve been trapped here for what feels like years. I know these halls well. I can teach you combat techniques.',
        choices: [
          { text: 'Teach me what you know.', nextNodeId: 'prisoner-2', effects: [{ type: 'trait', traitKey: 'compassion', value: 0.1 }] },
          { text: 'What do you know about the bosses?', nextNodeId: 'prisoner-3', effects: [] },
          { text: '[Compassion > 0.4] Here, take some gold for your journey.', nextNodeId: 'prisoner-4', effects: [{ type: 'gold', value: -15 }], traitRequirement: { trait: 'compassion', minValue: 0.4 } },
        ],
      },
      {
        id: 'prisoner-2', text: 'The Whirlwind technique — spin your blade to hit all foes at once. And this shield — I won\'t need it where I\'m going.',
        choices: [{ text: 'Thank you, Galen.', effects: [{ type: 'item', id: 'item-oak-shield' }] }],
      },
      {
        id: 'prisoner-3', text: 'The Warden guards the first gate. It reflects direct damage at low health — switch to DoT effects when it hunkers down. The Lich on Floor 2 drains mana with an aura. Stock up on stamina-based skills.',
        choices: [{ text: 'Invaluable intel.', effects: [{ type: 'quest_flag', id: 'boss_intel' }] }],
      },
      {
        id: 'prisoner-4', text: 'You\'re a rare soul. Take this — an Aether Rune I found hidden in the walls. May it serve you better than it served me.',
        choices: [{ text: 'I\'ll put it to good use.', effects: [{ type: 'rune', id: 'rune-arcane' }, { type: 'trait', traitKey: 'compassion', value: 0.1 }, { type: 'trait', traitKey: 'resilience', value: 0.05 }] }],
      },
    ],
  },
];

// ---- FLOOR DATA ----
export function createFloors(): Floor[] {
  const floor1Rooms: Room[] = [
    {
      id: 'f1-entrance', name: 'Dungeon Entrance', type: 'event', floor: 1,
      description: 'The entrance hall. Torches flicker in the damp air. An old sage sits by the wall.',
      icon: 'game-icons:dungeon-gate', connections: ['f1-combat1', 'f1-forge1'],
      cleared: false, discovered: true, gridX: 1, gridY: 0,
      npc: ALL_NPCS[0], // Sage
    },
    {
      id: 'f1-combat1', name: 'Slime Den', type: 'combat', floor: 1,
      description: 'The floor is slick with ooze. Stone Slimes lurk in the shadows.',
      icon: 'game-icons:slime', connections: ['f1-entrance', 'f1-rest1', 'f1-training1'],
      enemies: [{ ...f1Enemies.slime }, { ...f1Enemies.rat }],
      cleared: false, discovered: true, gridX: 0, gridY: 1,
      lootTable: [{ itemId: 'item-hp-potion', chance: 0.3 }],
    },
    {
      id: 'f1-forge1', name: 'Ancient Forge', type: 'forge', floor: 1,
      description: 'A magical forge hums with arcane energy. Runes can be combined here.',
      icon: 'game-icons:anvil', connections: ['f1-entrance', 'f1-combat2'],
      cleared: false, discovered: true, gridX: 2, gridY: 1,
    },
    {
      id: 'f1-training1', name: 'Training Grounds', type: 'training', floor: 1,
      description: 'Stone dummies stand ready. Practice your spells here to build rune affinity.',
      icon: 'game-icons:training', connections: ['f1-combat1', 'f1-elite1'],
      enemies: [makeEnemy({ id: 'dummy-1', name: 'Training Dummy', icon: 'game-icons:target-dummy', description: 'A sturdy training dummy. Low XP, no loot — just practice.', stats: { hp: 100, maxHp: 100, mana: 0, maxMana: 0, stamina: 0, maxStamina: 0, attack: 3, defense: 2, speed: 1, level: 1, xp: 0, xpToLevel: 100 }, xpReward: 3, goldReward: 0, loot: [] })],
      cleared: false, discovered: false, gridX: 0, gridY: 2,
    },
    {
      id: 'f1-rest1', name: 'Mossy Alcove', type: 'rest', floor: 1,
      description: 'A quiet spot with a natural spring. Rest here to recover.',
      icon: 'game-icons:camp-fire', connections: ['f1-combat1', 'f1-elite1'],
      cleared: false, discovered: false, gridX: 1, gridY: 2,
    },
    {
      id: 'f1-combat2', name: 'Bone Corridor', type: 'combat', floor: 1,
      description: 'Bones crunch underfoot. Skeletons rise from the rubble.',
      icon: 'game-icons:skeleton', connections: ['f1-forge1', 'f1-elite1'],
      enemies: [{ ...f1Enemies.skeleton }, { ...f1Enemies.rat }],
      cleared: false, discovered: false, gridX: 2, gridY: 2,
      lootTable: [{ itemId: 'item-iron-sword', chance: 0.15 }],
    },
    {
      id: 'f1-elite1', name: 'Crystal Chamber', type: 'elite', floor: 1,
      description: 'A massive Crystal Golem guards this room. Physical attacks are useless — use elemental spells.',
      icon: 'game-icons:rock-golem', connections: ['f1-training1', 'f1-rest1', 'f1-combat2', 'f1-boss'],
      enemies: [{ ...f1Enemies.eliteGolem }],
      cleared: false, discovered: false, gridX: 1, gridY: 3,
      runeReward: 'rune-nature',
    },
    {
      id: 'f1-boss', name: 'Warden\'s Gate', type: 'boss', floor: 1,
      description: 'The Warden blocks the path to the deeper floors. It reflects direct damage — use DoT and status effects.',
      icon: 'game-icons:crowned-skull', connections: ['f1-elite1'],
      enemies: [{ ...f1Boss }],
      cleared: false, discovered: false, gridX: 1, gridY: 4,
    },
  ];

  const floor2Rooms: Room[] = [
    {
      id: 'f2-entrance', name: 'Dark Descent', type: 'event', floor: 2,
      description: 'The air grows colder. You sense powerful magic ahead. A prisoner huddles in a corner.',
      icon: 'game-icons:stairs', connections: ['f2-combat1', 'f2-merchant1'],
      cleared: false, discovered: true, gridX: 1, gridY: 0,
      npc: ALL_NPCS[2], // Prisoner
    },
    {
      id: 'f2-combat1', name: 'Wraith Hollow', type: 'combat', floor: 2,
      description: 'Mana wraiths drift through the walls. They drain your magical reserves.',
      icon: 'game-icons:spectre', connections: ['f2-entrance', 'f2-event1', 'f2-forge1'],
      enemies: [{ ...f2Enemies.wraith }, { ...f2Enemies.wraith }],
      cleared: false, discovered: true, gridX: 0, gridY: 1,
      lootTable: [{ itemId: 'item-mana-potion', chance: 0.4 }],
    },
    {
      id: 'f2-merchant1', name: 'Underground Market', type: 'merchant', floor: 2,
      description: 'A mysterious merchant has set up shop in an alcove. Gold glitters on the shelves.',
      icon: 'game-icons:shop', connections: ['f2-entrance', 'f2-combat2'],
      cleared: false, discovered: true, gridX: 2, gridY: 1,
      merchantStock: [
        cloneItem('item-hp-potion', 3),
        cloneItem('item-mana-potion', 3),
        cloneItem('item-stamina-potion', 2),
        cloneItem('item-chain-mail'),
        cloneItem('item-steel-sword'),
        cloneItem('item-fire-ring'),
        { ...ALL_RUNES[4], id: 'rune-arcane', name: 'Aether Rune', category: 'rune', icon: 'game-icons:crystal-ball', description: 'Pure arcane essence', quantity: 1, value: 45 } as any,
      ],
    },
    {
      id: 'f2-event1', name: 'Shadow Crossroads', type: 'event', floor: 2,
      description: 'A cloaked figure beckons from the shadows. Kira has information to trade.',
      icon: 'game-icons:crossroads', connections: ['f2-combat1', 'f2-rest1'],
      cleared: false, discovered: false, gridX: 0, gridY: 2,
      npc: ALL_NPCS[1], // Thief
    },
    {
      id: 'f2-forge1', name: 'Shadow Forge', type: 'forge', floor: 2,
      description: 'A darker forge infused with shadow energy. More powerful combinations are possible here.',
      icon: 'game-icons:anvil-impact', connections: ['f2-combat1', 'f2-elite1'],
      cleared: false, discovered: false, gridX: 1, gridY: 2,
    },
    {
      id: 'f2-combat2', name: 'Gargoyle Gallery', type: 'combat', floor: 2,
      description: 'Stone gargoyles line the walls. Some are not just decoration.',
      icon: 'game-icons:gargoyle', connections: ['f2-merchant1', 'f2-elite1'],
      enemies: [{ ...f2Enemies.gargoyle }, { ...f2Enemies.cultist }],
      cleared: false, discovered: false, gridX: 2, gridY: 2,
      lootTable: [{ itemId: 'item-chain-mail', chance: 0.2 }],
    },
    {
      id: 'f2-rest1', name: 'Hidden Sanctuary', type: 'rest', floor: 2,
      description: 'A sacred grove somehow growing underground. Rest and restore your strength.',
      icon: 'game-icons:meditation', connections: ['f2-event1', 'f2-elite1'],
      cleared: false, discovered: false, gridX: 0, gridY: 3,
    },
    {
      id: 'f2-elite1', name: 'Mirror Hall', type: 'elite', floor: 2,
      description: 'The Mirror Knight reflects all direct damage. Use DoT, debuffs, or indirect attacks.',
      icon: 'game-icons:mirror-mirror', connections: ['f2-forge1', 'f2-combat2', 'f2-rest1', 'f2-boss'],
      enemies: [{ ...f2Enemies.eliteMirror }],
      cleared: false, discovered: false, gridX: 1, gridY: 3,
    },
    {
      id: 'f2-boss', name: 'Archon\'s Throne', type: 'boss', floor: 2,
      description: 'The Lich Archon sits upon a throne of bones. It drains mana with an aura — rely on physical skills and nature magic.',
      icon: 'game-icons:lich-king', connections: ['f2-elite1'],
      enemies: [{ ...f2Boss }],
      cleared: false, discovered: false, gridX: 1, gridY: 4,
    },
  ];

  return [
    {
      id: 1, name: 'The Upper Dungeon', rooms: floor1Rooms,
      mechanicalConstraint: 'Enemies resistant to raw physical damage — must use elemental spells',
      bossRoomId: 'f1-boss', cleared: false,
    },
    {
      id: 2, name: 'The Deep Halls', rooms: floor2Rooms,
      mechanicalConstraint: 'Enemies reflect or resist direct damage — use DoT, debuffs, nature/shadow',
      bossRoomId: 'f2-boss', cleared: false,
    },
  ];
}

// ---- Spell crafting recipes ----
export interface CraftRecipe {
  ingredients: string[]; // rune/spell ids
  result: Partial<Spell>;
}

// Procedural spell naming
const ELEMENT_PREFIXES: Record<Element, string[]> = {
  fire: ['Flame', 'Ember', 'Inferno', 'Blaze', 'Scorch'],
  ice: ['Frost', 'Glacial', 'Cryo', 'Frozen', 'Chill'],
  nature: ['Thorn', 'Verdant', 'Root', 'Bloom', 'Vine'],
  shadow: ['Shadow', 'Void', 'Dark', 'Umbral', 'Dusk'],
  arcane: ['Arcane', 'Aether', 'Mystic', 'Astral', 'Ether'],
};

const ELEMENT_SUFFIXES: Record<Element, string[]> = {
  fire: ['Bolt', 'Wave', 'Storm', 'Burst', 'Lance'],
  ice: ['Shard', 'Fall', 'Spike', 'Barrage', 'Comet'],
  nature: ['Wall', 'Surge', 'Bloom', 'Strike', 'Lash'],
  shadow: ['Strike', 'Pulse', 'Veil', 'Rend', 'Bane'],
  arcane: ['Surge', 'Nova', 'Beam', 'Cascade', 'Pulse'],
};

export function generateSpellName(elements: Element[], tier: number): string {
  if (elements.length === 0) return 'Unknown Spell';
  const primary = elements[0];
  const prefixes = ELEMENT_PREFIXES[primary];
  const prefix = prefixes[Math.min(tier - 1, prefixes.length - 1)];

  if (elements.length === 1) {
    const suffixes = ELEMENT_SUFFIXES[primary];
    const suffix = suffixes[Math.min(tier - 1, suffixes.length - 1)];
    return `${prefix} ${suffix}`;
  }

  const secondary = elements[1];
  const secPrefixes = ELEMENT_PREFIXES[secondary];
  const secPrefix = secPrefixes[0];
  const suffixes = ELEMENT_SUFFIXES[primary];
  const suffix = suffixes[Math.min(tier, suffixes.length - 1)];
  return `${secPrefix}${suffix.toLowerCase()} ${prefix}`;
}

export function craftSpell(ingredientIds: string[], allRunes: Rune[], allSpells: Spell[]): Spell | null {
  if (ingredientIds.length < 2) return null;
  // Check unique ingredients
  if (new Set(ingredientIds).size !== ingredientIds.length) return null;

  const elements: Element[] = [];
  let totalPower = 0;
  let totalCost = 0;
  const effects: import('./types').SpellEffect[] = [];

  for (const id of ingredientIds) {
    const rune = allRunes.find(r => r.id === id && r.discovered);
    if (rune) {
      if (!elements.includes(rune.element)) elements.push(rune.element);
      totalPower += 8 + Math.floor(rune.affinityLevel / 10);
      totalCost += 5;
      continue;
    }
    const spell = allSpells.find(s => s.id === id);
    if (spell) {
      for (const e of spell.elements) if (!elements.includes(e)) elements.push(e);
      totalPower += spell.power;
      totalCost += Math.floor(spell.manaCost * 0.7);
      effects.push(...spell.effects);
      continue;
    }
    return null; // invalid ingredient
  }

  const tier = Math.min(3, Math.max(1, Math.floor(totalPower / 15)));
  const name = generateSpellName(elements, tier);
  const damagePerElement = Math.floor(totalPower / elements.length);

  // Build effects from elements
  const craftedEffects: import('./types').SpellEffect[] = [];
  for (const elem of elements) {
    craftedEffects.push({
      type: 'damage', element: elem, value: damagePerElement,
      description: `Deals ${damagePerElement} ${elem} damage`,
    });
  }
  // Add DoT for multi-element
  if (elements.length >= 2) {
    craftedEffects.push({
      type: 'dot', element: elements[0], value: Math.floor(damagePerElement * 0.3),
      duration: 3, description: `Burns for ${Math.floor(damagePerElement * 0.3)} per turn`,
    });
  }

  const spell: Spell = {
    id: `spell-crafted-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    elements,
    runeIds: ingredientIds.filter(id => id.startsWith('rune-')),
    power: totalPower,
    manaCost: totalCost,
    tier,
    icon: elements.length >= 2 ? 'game-icons:magic-swirl' : `game-icons:${elements[0] === 'fire' ? 'fireball' : elements[0] === 'ice' ? 'ice-bolt' : elements[0] === 'nature' ? 'oak-leaf' : elements[0] === 'shadow' ? 'death-skull' : 'crystal-ball'}`,
    ingredients: ingredientIds,
    effects: craftedEffects,
  };

  return spell;
}

// ---- Merchant floor 1 stock ----
export const FLOOR1_MERCHANT_STOCK: Item[] = [
  cloneItem('item-hp-potion', 3),
  cloneItem('item-mana-potion', 2),
  cloneItem('item-iron-sword'),
  cloneItem('item-leather-armor'),
  cloneItem('item-focus-gem'),
];
