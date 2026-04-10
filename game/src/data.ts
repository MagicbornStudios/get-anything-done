// ============================================================
// Authored game data — floors, rooms, enemies, NPCs, runes, items
// ============================================================

import type { Floor, Enemy, NPC, Rune, Spell, SpellEffect, PhysicalSkill, Item, ActionPolicy, Traits, Element } from './types';

// ---- TRAIT DEFAULTS ----
export function defaultTraits(): Traits {
  return { aggression: 0.3, compassion: 0.5, cunning: 0.3, resilience: 0.4, arcaneAffinity: 0.2 };
}

// ---- RUNES (R-v5.02: not all available at start) ----
export const ALL_RUNES: Rune[] = [
  { id: 'rune-ember', name: 'Ember Rune', element: 'fire', icon: 'game-icons:fire-ring', description: 'A warm stone pulsing with fire energy', discovered: true, affinityLevel: 0, affinityMilestones: [{ level: 25, reward: 'Fire spells +20% power', claimed: false }, { level: 50, reward: 'Unlock Inferno combinations', claimed: false }, { level: 75, reward: 'Fire immunity aura', claimed: false }] },
  { id: 'rune-frost', name: 'Frost Rune', element: 'ice', icon: 'game-icons:ice-spell-cast', description: 'A shard of perpetual ice', discovered: true, affinityLevel: 0, affinityMilestones: [{ level: 25, reward: 'Ice spells slow enemies', claimed: false }, { level: 50, reward: 'Unlock Blizzard combinations', claimed: false }, { level: 75, reward: 'Frost shield passive', claimed: false }] },
  { id: 'rune-thorn', name: 'Thorn Rune', element: 'nature', icon: 'game-icons:thorny-vine', description: 'A living rune wrapped in vines', discovered: false, affinityLevel: 0, affinityMilestones: [{ level: 25, reward: 'Nature spells heal 10% on hit', claimed: false }, { level: 50, reward: 'Unlock Entangle combinations', claimed: false }, { level: 75, reward: 'Regeneration passive', claimed: false }] },
  { id: 'rune-void', name: 'Void Rune', element: 'shadow', icon: 'game-icons:death-zone', description: 'A fragment of the abyss', discovered: false, affinityLevel: 0, affinityMilestones: [{ level: 25, reward: 'Shadow spells drain mana', claimed: false }, { level: 50, reward: 'Unlock Oblivion combinations', claimed: false }, { level: 75, reward: 'Shadow cloak passive', claimed: false }] },
  { id: 'rune-prism', name: 'Prism Rune', element: 'arcane', icon: 'game-icons:crystal-ball', description: 'Refracts pure magical energy', discovered: false, affinityLevel: 0, affinityMilestones: [{ level: 25, reward: 'Arcane spells ignore 20% resist', claimed: false }, { level: 50, reward: 'Unlock Prismatic combinations', claimed: false }, { level: 75, reward: 'Mana regeneration passive', claimed: false }] },
];

// ---- STARTER SPELLS ----
export const STARTER_SPELLS: Spell[] = [
  {
    id: 'spell-spark', name: 'Spark', elements: ['fire'], runeIds: ['rune-ember'], power: 8, manaCost: 5,
    effects: [{ type: 'damage', element: 'fire', value: 8, description: 'Weak fire damage' }],
    icon: 'game-icons:flame', tier: 1, ingredients: ['rune-ember'],
  },
  {
    id: 'spell-chill', name: 'Chill Touch', elements: ['ice'], runeIds: ['rune-frost'], power: 6, manaCost: 4,
    effects: [{ type: 'damage', element: 'ice', value: 6, description: 'Weak ice damage' }, { type: 'debuff', value: -2, duration: 2, description: 'Slow: -2 speed for 2 turns' }],
    icon: 'game-icons:ice-bolt', tier: 1, ingredients: ['rune-frost'],
  },
];

// ---- PHYSICAL SKILLS (R-v5.06) ----
export const ALL_SKILLS: PhysicalSkill[] = [
  { id: 'skill-slash', name: 'Slash', staminaCost: 5, damage: 10, effects: [{ type: 'damage', value: 10, description: 'Physical slash' }], icon: 'game-icons:broadsword', unlocked: true, tier: 1, prerequisites: [] },
  { id: 'skill-shield-bash', name: 'Shield Bash', staminaCost: 8, damage: 6, effects: [{ type: 'damage', value: 6, description: 'Bash + stun' }, { type: 'status', value: 1, duration: 1, description: 'Stun 1 turn' }], icon: 'game-icons:shield-bash', unlocked: true, tier: 1, prerequisites: [] },
  { id: 'skill-power-strike', name: 'Power Strike', staminaCost: 12, damage: 18, effects: [{ type: 'damage', value: 18, description: 'Heavy physical blow' }], icon: 'game-icons:sword-clash', unlocked: false, tier: 2, prerequisites: ['skill-slash'] },
  { id: 'skill-whirlwind', name: 'Whirlwind', staminaCost: 15, damage: 12, effects: [{ type: 'damage', value: 12, description: 'AOE physical damage' }], icon: 'game-icons:spinning-sword', unlocked: false, tier: 2, prerequisites: ['skill-slash'] },
  { id: 'skill-execute', name: 'Execute', staminaCost: 20, damage: 30, effects: [{ type: 'damage', value: 30, description: 'Massive damage to low HP targets' }], icon: 'game-icons:decapitation', unlocked: false, tier: 3, prerequisites: ['skill-power-strike'] },
];

// ---- DEFAULT ACTION POLICIES ----
export const DEFAULT_POLICIES: ActionPolicy[] = [
  { id: 'pol-heal-low', condition: 'self_hp_below_30', action: 'heal', priority: 1, enabled: true },
  { id: 'pol-weak-spell', condition: 'enemy_has_weakness', action: 'exploit_weakness', priority: 2, enabled: true },
  { id: 'pol-spell', condition: 'self_mana_above_20', action: 'cast_spell', priority: 3, enabled: true },
  { id: 'pol-skill', condition: 'self_stamina_above_10', action: 'use_skill', priority: 4, enabled: true },
  { id: 'pol-attack', condition: 'always', action: 'basic_attack', priority: 5, enabled: true },
];

// ---- ITEMS ----
export const ALL_ITEMS: Item[] = [
  { id: 'item-health-potion', name: 'Health Potion', category: 'consumable', icon: 'game-icons:health-potion', description: 'Restores 30 HP', quantity: 1, value: 15 },
  { id: 'item-mana-potion', name: 'Mana Potion', category: 'consumable', icon: 'game-icons:potion-ball', description: 'Restores 20 Mana', quantity: 1, value: 12 },
  { id: 'item-stamina-tonic', name: 'Stamina Tonic', category: 'consumable', icon: 'game-icons:square-bottle', description: 'Restores 15 Stamina', quantity: 1, value: 10 },
  { id: 'item-iron-sword', name: 'Iron Sword', category: 'equipment', icon: 'game-icons:pointy-sword', description: '+5 Attack', quantity: 1, equipSlot: 'main-hand', statBonuses: { attack: 5 }, value: 30 },
  { id: 'item-wooden-shield', name: 'Wooden Shield', category: 'equipment', icon: 'game-icons:wooden-shield', description: '+3 Defense', quantity: 1, equipSlot: 'off-hand', statBonuses: { defense: 3 }, value: 20 },
  { id: 'item-leather-armor', name: 'Leather Armor', category: 'equipment', icon: 'game-icons:leather-armor', description: '+4 Defense, +10 Max HP', quantity: 1, equipSlot: 'body', statBonuses: { defense: 4, maxHp: 10 }, value: 35 },
  { id: 'item-fire-charm', name: 'Fire Charm', category: 'equipment', icon: 'game-icons:fire-gem', description: '+3 Attack, fire affinity boost', quantity: 1, equipSlot: 'trinket', statBonuses: { attack: 3 }, element: 'fire', value: 25 },
  { id: 'item-crystal-focus', name: 'Crystal Focus', category: 'equipment', icon: 'game-icons:crystal-wand', description: '+15 Max Mana', quantity: 1, equipSlot: 'off-hand', statBonuses: { maxMana: 15 }, value: 40 },
  { id: 'item-steel-sword', name: 'Steel Sword', category: 'equipment', icon: 'game-icons:broadsword', description: '+10 Attack', quantity: 1, equipSlot: 'main-hand', statBonuses: { attack: 10 }, value: 60 },
  { id: 'item-chainmail', name: 'Chainmail', category: 'equipment', icon: 'game-icons:chain-mail', description: '+8 Defense, +20 Max HP', quantity: 1, equipSlot: 'body', statBonuses: { defense: 8, maxHp: 20 }, value: 70 },
  { id: 'item-shadow-amulet', name: 'Shadow Amulet', category: 'equipment', icon: 'game-icons:gem-pendant', description: '+5 Speed, shadow resist', quantity: 1, equipSlot: 'trinket', statBonuses: { speed: 5 }, element: 'shadow', value: 45 },
];

// ---- ENEMIES ----
function makeEnemy(id: string, name: string, icon: string, level: number, hp: number, atk: number, def: number, spd: number, traits: Partial<Traits>, resistances: Record<string, number>, weaknesses: Record<string, number>, xpReward: number, goldReward: number, description: string, spells: Spell[] = [], loot: { itemId: string; chance: number }[] = []): Enemy {
  return {
    id, name, icon, description, xpReward, goldReward, spells, loot,
    stats: { hp, maxHp: hp, mana: 30, maxMana: 30, stamina: 20, maxStamina: 20, attack: atk, defense: def, speed: spd, level, xp: 0, xpToLevel: 100 },
    traits: { aggression: 0.5, compassion: 0.1, cunning: 0.3, resilience: 0.4, arcaneAffinity: 0.2, ...traits },
    resistances, weaknesses,
    actionPolicies: [
      { id: `${id}-pol-1`, condition: 'always', action: 'basic_attack', priority: 3, enabled: true },
      { id: `${id}-pol-2`, condition: 'self_hp_below_30', action: 'heal', priority: 1, enabled: true },
    ],
  };
}

// Floor 1 enemies: resistant to raw physical damage → need DoT/status effects
const FLOOR1_ENEMIES = {
  slime: () => makeEnemy('enemy-slime', 'Stone Slime', 'game-icons:gooey-daemon', 1, 35, 6, 8, 3, { resilience: 0.8 }, { fire: 0.5 }, { fire: 1.5, nature: 1.3 }, 15, 8, 'A gelatinous creature with hardened stone skin. Physical attacks barely dent it.', [], [{ itemId: 'item-health-potion', chance: 0.3 }]),
  rat: () => makeEnemy('enemy-rat', 'Cave Rat', 'game-icons:rat', 1, 20, 8, 3, 8, { aggression: 0.8 }, {}, { ice: 1.3 }, 10, 5, 'Quick and aggressive, attacks in flurries.', [], [{ itemId: 'item-stamina-tonic', chance: 0.2 }]),
  skeleton: () => makeEnemy('enemy-skeleton', 'Skeleton Guard', 'game-icons:skeleton', 2, 45, 10, 6, 4, { aggression: 0.6, resilience: 0.6 }, { shadow: 0.3, ice: 0.7 }, { fire: 1.5, nature: 1.2 }, 20, 12, 'An undead sentinel. Shadow magic barely affects it.', [], [{ itemId: 'item-iron-sword', chance: 0.1 }]),
  spider: () => makeEnemy('enemy-spider', 'Venom Spider', 'game-icons:spider-alt', 2, 30, 12, 4, 7, { cunning: 0.7 }, { nature: 0.5 }, { fire: 1.4 }, 18, 10, 'Spits venom and webs. Nature-resistant.', [{ id: 'spell-venom', name: 'Venom Spit', elements: ['nature'], runeIds: [], power: 8, manaCost: 5, effects: [{ type: 'dot', element: 'nature', value: 3, duration: 3, description: 'Poison: 3 damage for 3 turns' }], icon: 'game-icons:poison-bottle', tier: 1, ingredients: [] }], [{ itemId: 'item-mana-potion', chance: 0.25 }]),
};

// Floor 1 boss: resistant to everything except crafted spells
const FLOOR1_BOSS = () => makeEnemy('enemy-golem', 'Crystal Golem', 'game-icons:rock-golem', 3, 100, 14, 12, 2,
  { resilience: 0.9, aggression: 0.4 },
  { fire: 0.7, ice: 0.7, nature: 0.5 }, { shadow: 1.3, arcane: 1.5 },
  50, 30, 'A massive golem of living crystal. Resists basic elements — only crafted or shadow/arcane spells can crack it.',
  [{ id: 'spell-crystal-slam', name: 'Crystal Slam', elements: ['arcane'], runeIds: [], power: 15, manaCost: 8, effects: [{ type: 'damage', element: 'arcane', value: 15, description: 'Arcane slam' }], icon: 'game-icons:crystal-growth', tier: 2, ingredients: [] }],
  [{ itemId: 'item-steel-sword', chance: 0.5 }, { itemId: 'item-chainmail', chance: 0.3 }]
);

// Floor 2 enemies: reflect direct damage → need indirect/status effects
const FLOOR2_ENEMIES = {
  wraith: () => makeEnemy('enemy-wraith', 'Mirror Wraith', 'game-icons:spectre', 3, 50, 14, 5, 9, { cunning: 0.8 }, { fire: 0.8, ice: 0.8 }, { shadow: 1.4, nature: 1.2 }, 25, 15, 'Reflects direct damage spells. Use status effects or physical skills.', [{ id: 'spell-drain', name: 'Life Drain', elements: ['shadow'], runeIds: [], power: 10, manaCost: 6, effects: [{ type: 'damage', element: 'shadow', value: 10, description: 'Shadow drain' }, { type: 'heal', value: 5, description: 'Heals 5 HP' }], icon: 'game-icons:bleeding-wound', tier: 1, ingredients: [] }], [{ itemId: 'item-shadow-amulet', chance: 0.15 }]),
  gargoyle: () => makeEnemy('enemy-gargoyle', 'Stone Gargoyle', 'game-icons:gargoyle', 3, 65, 12, 14, 3, { resilience: 0.9, aggression: 0.5 }, { fire: 0.6, ice: 0.6, nature: 0.6 }, { arcane: 1.5 }, 28, 18, 'Extremely hard. Only arcane or crafted spells pierce its defenses.', [], [{ itemId: 'item-crystal-focus', chance: 0.2 }]),
  cultist: () => makeEnemy('enemy-cultist', 'Shadow Cultist', 'game-icons:cultist', 4, 40, 16, 6, 7, { aggression: 0.7, arcaneAffinity: 0.6 }, { shadow: 0.3 }, { fire: 1.3, nature: 1.2 }, 30, 20, 'Wields dark magic and is nearly immune to shadow.', [{ id: 'spell-shadow-bolt', name: 'Shadow Bolt', elements: ['shadow'], runeIds: [], power: 14, manaCost: 7, effects: [{ type: 'damage', element: 'shadow', value: 14, description: 'Shadow bolt' }], icon: 'game-icons:shadow-grasp', tier: 2, ingredients: [] }], [{ itemId: 'item-mana-potion', chance: 0.3 }]),
  mimic: () => makeEnemy('enemy-mimic', 'Treasure Mimic', 'game-icons:treasure-map', 4, 55, 18, 8, 6, { cunning: 0.9 }, {}, { fire: 1.2, ice: 1.2 }, 35, 25, 'Disguised as a chest. Hits hard but vulnerable to elemental spells.', [], [{ itemId: 'item-health-potion', chance: 0.5 }, { itemId: 'item-fire-charm', chance: 0.2 }]),
};

// Floor 2 boss
const FLOOR2_BOSS = () => makeEnemy('enemy-lich', 'The Lich King', 'game-icons:crowned-skull', 5, 150, 20, 10, 6,
  { aggression: 0.6, cunning: 0.9, arcaneAffinity: 0.9 },
  { shadow: 0.2, arcane: 0.5, fire: 0.7 }, { nature: 1.5, ice: 1.3 },
  80, 50, 'The master of the dungeon. Absorbs shadow, resists arcane and fire. Only nature and ice combinations can defeat it.',
  [
    { id: 'spell-necrotic-wave', name: 'Necrotic Wave', elements: ['shadow'], runeIds: [], power: 20, manaCost: 10, effects: [{ type: 'damage', element: 'shadow', value: 20, description: 'Necrotic wave' }, { type: 'debuff', value: -3, duration: 2, description: '-3 defense for 2 turns' }], icon: 'game-icons:death-zone', tier: 2, ingredients: [] },
    { id: 'spell-soul-siphon', name: 'Soul Siphon', elements: ['shadow'], runeIds: [], power: 12, manaCost: 8, effects: [{ type: 'damage', element: 'shadow', value: 12, description: 'Drains soul' }, { type: 'heal', value: 10, description: 'Heals 10 HP' }], icon: 'game-icons:ghost', tier: 2, ingredients: [] },
  ],
  [{ itemId: 'item-shadow-amulet', chance: 1.0 }]
);

// ---- NPCs (R-v5.04) ----
const NPC_SAGE: NPC = {
  id: 'npc-sage', name: 'Elder Sage', icon: 'game-icons:wizard-face', portrait: 'game-icons:wizard-face',
  traits: { aggression: 0.1, compassion: 0.8, cunning: 0.6, resilience: 0.3, arcaneAffinity: 0.9 },
  dialogue: [
    { id: 'sage-1', text: 'Ah, another soul trapped in these depths. The Crystal Golem on this floor resists all basic elements. You will need to forge shadow or arcane spells to crack its shell.', speaker: 'Elder Sage', choices: [
      { text: 'Thank you for the wisdom. (Gain Prism Rune)', effects: [{ type: 'rune', id: 'rune-prism' }, { type: 'trait', traitKey: 'compassion', value: 0.1 }] },
      { text: 'I don\'t need your help, old man. (Gain +0.1 aggression)', effects: [{ type: 'trait', traitKey: 'aggression', value: 0.1 }] },
      { text: 'What else can you tell me?', nextNodeId: 'sage-2', effects: [] },
    ]},
    { id: 'sage-2', text: 'The runes scattered through this dungeon hold the key. Each one you discover can be forged into new spells. But beware — the deeper floors demand adaptation. Your starter spells will not suffice.', speaker: 'Elder Sage', choices: [
      { text: 'I understand. (Gain 20 gold)', effects: [{ type: 'gold', value: 20 }, { type: 'trait', traitKey: 'cunning', value: 0.05 }] },
    ]},
  ],
};

const NPC_GHOST: NPC = {
  id: 'npc-ghost', name: 'Tormented Spirit', icon: 'game-icons:ghost', portrait: 'game-icons:ghost',
  traits: { aggression: 0.2, compassion: 0.3, cunning: 0.4, resilience: 0.1, arcaneAffinity: 0.7 },
  dialogue: [
    { id: 'ghost-1', text: 'I was once an adventurer like you... The Lich trapped my soul here. If you defeat him, I can rest. Take this — it may help against his servants.', speaker: 'Tormented Spirit', choices: [
      { text: 'I will free you. (Gain Void Rune)', effects: [{ type: 'rune', id: 'rune-void' }, { type: 'quest_flag', id: 'free_ghost' }, { type: 'trait', traitKey: 'compassion', value: 0.15 }] },
      { text: 'What\'s in it for me?', nextNodeId: 'ghost-2', effects: [{ type: 'trait', traitKey: 'cunning', value: 0.1 }] },
    ]},
    { id: 'ghost-2', text: 'A practical one, I see. Very well — defeat the Lich and I will reveal the location of a hidden treasure cache. But take this rune regardless, you will need it.', speaker: 'Tormented Spirit', choices: [
      { text: 'Deal. (Gain Void Rune + 30 gold)', effects: [{ type: 'rune', id: 'rune-void' }, { type: 'gold', value: 30 }, { type: 'quest_flag', id: 'ghost_deal' }] },
    ]},
  ],
};

const NPC_HERMIT: NPC = {
  id: 'npc-hermit', name: 'Mushroom Hermit', icon: 'game-icons:mushroom-gills', portrait: 'game-icons:mushroom-gills',
  traits: { aggression: 0.0, compassion: 0.6, cunning: 0.8, resilience: 0.5, arcaneAffinity: 0.3 },
  dialogue: [
    { id: 'hermit-1', text: 'These caves... they speak to those who listen. The vines here remember. Would you like to learn their secrets?', speaker: 'Mushroom Hermit', choices: [
      { text: 'Teach me about nature magic. (Gain Thorn Rune)', effects: [{ type: 'rune', id: 'rune-thorn' }, { type: 'trait', traitKey: 'arcaneAffinity', value: 0.1 }] },
      { text: 'I seek strength, not botany.', nextNodeId: 'hermit-2', effects: [{ type: 'trait', traitKey: 'aggression', value: 0.05 }] },
      { text: 'Do you have anything to sell?', effects: [{ type: 'merchant_discount', value: 10 }, { type: 'trait', traitKey: 'cunning', value: 0.05 }] },
    ]},
    { id: 'hermit-2', text: 'Hmph. Strength fades, knowledge endures. But very well — take this health potion and be on your way.', speaker: 'Mushroom Hermit', choices: [
      { text: 'Thanks. (Gain Health Potion)', effects: [{ type: 'item', id: 'item-health-potion' }] },
    ]},
  ],
};

// ---- MERCHANT STOCK ----
const FLOOR1_MERCHANT_STOCK: Item[] = [
  { ...ALL_ITEMS[0], quantity: 3 }, // health potion
  { ...ALL_ITEMS[1], quantity: 2 }, // mana potion
  { ...ALL_ITEMS[2], quantity: 2 }, // stamina tonic
  { ...ALL_ITEMS[3], quantity: 1 }, // iron sword
  { ...ALL_ITEMS[4], quantity: 1 }, // wooden shield
  { ...ALL_ITEMS[5], quantity: 1 }, // leather armor
];

const FLOOR2_MERCHANT_STOCK: Item[] = [
  { ...ALL_ITEMS[0], quantity: 5 },
  { ...ALL_ITEMS[1], quantity: 3 },
  { ...ALL_ITEMS[8], quantity: 1 }, // steel sword
  { ...ALL_ITEMS[9], quantity: 1 }, // chainmail
  { ...ALL_ITEMS[7], quantity: 1 }, // crystal focus
  { ...ALL_ITEMS[10], quantity: 1 }, // shadow amulet
];

// ---- FLOORS ----
export function createFloors(): Floor[] {
  return [
    {
      id: 1, name: 'The Crystal Caverns', cleared: false,
      mechanicalConstraint: 'Enemies resistant to raw physical/basic damage. Require fire DoT or crafted spells.',
      bossRoomId: 'f1-boss',
      rooms: [
        { id: 'f1-entrance', name: 'Cavern Entrance', type: 'combat', floor: 1, description: 'The entrance to the dungeon. Slimy creatures lurk here.', icon: 'game-icons:cave-entrance', connections: ['f1-forge', 'f1-event1'], enemies: [FLOOR1_ENEMIES.slime(), FLOOR1_ENEMIES.rat()], cleared: false, discovered: true, gridX: 2, gridY: 0 },
        { id: 'f1-forge', name: 'Ancient Forge', type: 'forge', floor: 1, description: 'A magical forge still burning with arcane fire.', icon: 'game-icons:anvil', connections: ['f1-entrance', 'f1-combat2'], cleared: false, discovered: false, gridX: 1, gridY: 1 },
        { id: 'f1-event1', name: 'Sage\'s Alcove', type: 'event', floor: 1, description: 'An old sage sits in a quiet alcove.', icon: 'game-icons:scroll-unfurled', connections: ['f1-entrance', 'f1-merchant'], npc: NPC_SAGE, cleared: false, discovered: false, gridX: 3, gridY: 1, runeReward: 'rune-prism' },
        { id: 'f1-combat2', name: 'Spider Nest', type: 'combat', floor: 1, description: 'Webs everywhere. Spiders descend from the ceiling.', icon: 'game-icons:spider-web', connections: ['f1-forge', 'f1-rest'], enemies: [FLOOR1_ENEMIES.spider(), FLOOR1_ENEMIES.spider()], cleared: false, discovered: false, gridX: 0, gridY: 2 },
        { id: 'f1-merchant', name: 'Wandering Trader', type: 'merchant', floor: 1, description: 'A hooded merchant with a large pack.', icon: 'game-icons:trade', connections: ['f1-event1', 'f1-elite'], merchantStock: FLOOR1_MERCHANT_STOCK, cleared: false, discovered: false, gridX: 4, gridY: 2 },
        { id: 'f1-rest', name: 'Underground Spring', type: 'rest', floor: 1, description: 'A peaceful underground spring. Rest here to recover.', icon: 'game-icons:campfire', connections: ['f1-combat2', 'f1-elite'], cleared: false, discovered: false, gridX: 1, gridY: 3 },
        { id: 'f1-elite', name: 'Skeleton Hall', type: 'elite', floor: 1, description: 'Ranks of skeleton guards stand watch. They resist shadow and ice.', icon: 'game-icons:skeleton-inside', connections: ['f1-merchant', 'f1-rest', 'f1-training', 'f1-boss'], enemies: [FLOOR1_ENEMIES.skeleton(), FLOOR1_ENEMIES.skeleton(), FLOOR1_ENEMIES.rat()], cleared: false, discovered: false, gridX: 3, gridY: 3 },
        { id: 'f1-training', name: 'Training Grounds', type: 'training', floor: 1, description: 'Practice dummies stand ready. Train your spells safely.', icon: 'game-icons:target-dummy', connections: ['f1-elite'], enemies: [makeEnemy('enemy-dummy', 'Training Dummy', 'game-icons:target-dummy', 1, 999, 0, 0, 0, {}, {}, {}, 2, 0, 'A wooden dummy. Does not attack. Perfect for training affinities.')], cleared: false, discovered: false, gridX: 2, gridY: 4 },
        { id: 'f1-boss', name: 'Crystal Chamber', type: 'boss', floor: 1, description: 'A massive crystal golem guards the passage deeper.', icon: 'game-icons:boss-key', connections: ['f1-elite'], enemies: [FLOOR1_BOSS()], cleared: false, discovered: false, gridX: 3, gridY: 5 },
      ],
    },
    {
      id: 2, name: 'The Shadow Depths', cleared: false,
      mechanicalConstraint: 'Enemies reflect direct damage. Use status effects, indirect damage, or physical skills.',
      bossRoomId: 'f2-boss',
      rooms: [
        { id: 'f2-entrance', name: 'Descent Stairs', type: 'combat', floor: 2, description: 'Dark stairs leading deeper. Wraiths drift in the shadows.', icon: 'game-icons:stone-stairs', connections: ['f2-event1', 'f2-forge'], enemies: [FLOOR2_ENEMIES.wraith(), FLOOR2_ENEMIES.cultist()], cleared: false, discovered: true, gridX: 2, gridY: 0 },
        { id: 'f2-event1', name: 'Spirit\'s Rest', type: 'event', floor: 2, description: 'A ghost lingers, seeking aid.', icon: 'game-icons:haunting', connections: ['f2-entrance', 'f2-combat2'], npc: NPC_GHOST, cleared: false, discovered: false, gridX: 1, gridY: 1, runeReward: 'rune-void' },
        { id: 'f2-forge', name: 'Shadow Forge', type: 'forge', floor: 2, description: 'A forge powered by shadow energy.', icon: 'game-icons:anvil-impact', connections: ['f2-entrance', 'f2-merchant'], cleared: false, discovered: false, gridX: 3, gridY: 1 },
        { id: 'f2-combat2', name: 'Gargoyle Gallery', type: 'combat', floor: 2, description: 'Stone gargoyles line the walls. Some are not as still as they seem.', icon: 'game-icons:gargoyle', connections: ['f2-event1', 'f2-rest'], enemies: [FLOOR2_ENEMIES.gargoyle(), FLOOR2_ENEMIES.gargoyle()], cleared: false, discovered: false, gridX: 0, gridY: 2 },
        { id: 'f2-merchant', name: 'Black Market', type: 'merchant', floor: 2, description: 'A cloaked figure sells rare goods.', icon: 'game-icons:shop', connections: ['f2-forge', 'f2-elite'], merchantStock: FLOOR2_MERCHANT_STOCK, cleared: false, discovered: false, gridX: 4, gridY: 2 },
        { id: 'f2-rest', name: 'Fungal Grotto', type: 'rest', floor: 2, description: 'Glowing mushrooms provide warmth. A hermit lives here.', icon: 'game-icons:mushroom-house', connections: ['f2-combat2', 'f2-elite'], npc: NPC_HERMIT, cleared: false, discovered: false, gridX: 1, gridY: 3 },
        { id: 'f2-elite', name: 'Mimic Treasury', type: 'elite', floor: 2, description: 'Chests and treasures — but which are real?', icon: 'game-icons:locked-chest', connections: ['f2-merchant', 'f2-rest', 'f2-training', 'f2-boss'], enemies: [FLOOR2_ENEMIES.mimic(), FLOOR2_ENEMIES.mimic(), FLOOR2_ENEMIES.cultist()], cleared: false, discovered: false, gridX: 3, gridY: 3 },
        { id: 'f2-training', name: 'Dark Training Hall', type: 'training', floor: 2, description: 'Shadow-infused training dummies.', icon: 'game-icons:target-dummy', connections: ['f2-elite'], enemies: [makeEnemy('enemy-dummy2', 'Shadow Dummy', 'game-icons:target-dummy', 1, 999, 0, 0, 0, {}, {}, {}, 3, 0, 'A shadow-infused dummy. Does not attack.')], cleared: false, discovered: false, gridX: 2, gridY: 4 },
        { id: 'f2-boss', name: 'Lich\'s Throne', type: 'boss', floor: 2, description: 'The Lich King sits on a throne of bones. This is the final challenge.', icon: 'game-icons:skull-throne', connections: ['f2-elite'], enemies: [FLOOR2_BOSS()], cleared: false, discovered: false, gridX: 3, gridY: 5 },
      ],
    },
  ];
}

// ---- SPELL CRAFTING RECIPES (R-v5.19, R-v5.20) ----
export interface SpellRecipe {
  ingredients: string[];
  result: { name: string; elements: string[]; power: number; manaCost: number; effects: SpellEffect[]; icon: string; tier: number };
}

export const SPELL_RECIPES: SpellRecipe[] = [
  { ingredients: ['rune-ember', 'rune-frost'], result: { name: 'Frostfire Bolt', elements: ['fire', 'ice'], power: 18, manaCost: 10, effects: [{ type: 'damage', element: 'fire', value: 10, description: 'Fire damage' }, { type: 'damage', element: 'ice', value: 8, description: 'Ice damage' }, { type: 'debuff', value: -2, duration: 2, description: 'Slow for 2 turns' }], icon: 'game-icons:fire-dash', tier: 2 } },
  { ingredients: ['rune-ember', 'rune-thorn'], result: { name: 'Wildfire Bloom', elements: ['fire', 'nature'], power: 16, manaCost: 9, effects: [{ type: 'damage', element: 'fire', value: 8, description: 'Fire burst' }, { type: 'dot', element: 'nature', value: 4, duration: 3, description: 'Burning vines: 4 damage for 3 turns' }], icon: 'game-icons:fire-flower', tier: 2 } },
  { ingredients: ['rune-frost', 'rune-thorn'], result: { name: 'Frozen Thorns', elements: ['ice', 'nature'], power: 15, manaCost: 8, effects: [{ type: 'damage', element: 'ice', value: 7, description: 'Ice spike' }, { type: 'damage', element: 'nature', value: 8, description: 'Thorn pierce' }, { type: 'status', value: 1, duration: 1, description: 'Root for 1 turn' }], icon: 'game-icons:thorn-arrow', tier: 2 } },
  { ingredients: ['rune-ember', 'rune-void'], result: { name: 'Shadowflame', elements: ['fire', 'shadow'], power: 22, manaCost: 12, effects: [{ type: 'damage', element: 'fire', value: 12, description: 'Shadowflame' }, { type: 'damage', element: 'shadow', value: 10, description: 'Shadow burn' }, { type: 'debuff', value: -3, duration: 2, description: '-3 defense for 2 turns' }], icon: 'game-icons:fire-breath', tier: 2 } },
  { ingredients: ['rune-frost', 'rune-void'], result: { name: 'Void Chill', elements: ['ice', 'shadow'], power: 20, manaCost: 11, effects: [{ type: 'damage', element: 'shadow', value: 12, description: 'Void freeze' }, { type: 'dot', element: 'ice', value: 3, duration: 4, description: 'Frostbite: 3 damage for 4 turns' }], icon: 'game-icons:frozen-orb', tier: 2 } },
  { ingredients: ['rune-thorn', 'rune-void'], result: { name: 'Death Blossom', elements: ['nature', 'shadow'], power: 19, manaCost: 10, effects: [{ type: 'damage', element: 'nature', value: 10, description: 'Toxic bloom' }, { type: 'damage', element: 'shadow', value: 9, description: 'Shadow drain' }, { type: 'heal', value: 8, description: 'Drain heal 8 HP' }], icon: 'game-icons:carnivorous-plant', tier: 2 } },
  { ingredients: ['rune-prism', 'rune-ember'], result: { name: 'Prismatic Flare', elements: ['arcane', 'fire'], power: 24, manaCost: 14, effects: [{ type: 'damage', element: 'arcane', value: 14, description: 'Prismatic fire' }, { type: 'damage', element: 'fire', value: 10, description: 'Fire burst' }], icon: 'game-icons:crystal-shine', tier: 2 } },
  { ingredients: ['rune-prism', 'rune-frost'], result: { name: 'Crystal Storm', elements: ['arcane', 'ice'], power: 22, manaCost: 13, effects: [{ type: 'damage', element: 'arcane', value: 12, description: 'Crystal shards' }, { type: 'damage', element: 'ice', value: 10, description: 'Ice storm' }, { type: 'debuff', value: -4, duration: 2, description: '-4 speed for 2 turns' }], icon: 'game-icons:crystal-cluster', tier: 2 } },
  { ingredients: ['rune-prism', 'rune-void'], result: { name: 'Oblivion Ray', elements: ['arcane', 'shadow'], power: 28, manaCost: 16, effects: [{ type: 'damage', element: 'arcane', value: 16, description: 'Arcane annihilation' }, { type: 'damage', element: 'shadow', value: 12, description: 'Shadow obliteration' }], icon: 'game-icons:laser-blast', tier: 3 } },
  { ingredients: ['rune-prism', 'rune-thorn'], result: { name: 'Living Crystal', elements: ['arcane', 'nature'], power: 20, manaCost: 12, effects: [{ type: 'damage', element: 'arcane', value: 10, description: 'Crystal growth' }, { type: 'heal', value: 12, description: 'Nature restore 12 HP' }, { type: 'buff', value: 3, duration: 3, description: '+3 defense for 3 turns' }], icon: 'game-icons:crystal-growth', tier: 2 } },
  // Spell + rune combinations (R-v5.19)
  { ingredients: ['spell-spark', 'rune-frost'], result: { name: 'Frostfall Ember', elements: ['fire', 'ice'], power: 20, manaCost: 11, effects: [{ type: 'damage', element: 'fire', value: 12, description: 'Evolved fire' }, { type: 'dot', element: 'ice', value: 4, duration: 3, description: 'Frostburn: 4 damage for 3 turns' }], icon: 'game-icons:fire-dash', tier: 2 } },
  { ingredients: ['spell-chill', 'rune-ember'], result: { name: 'Steamblast', elements: ['ice', 'fire'], power: 19, manaCost: 10, effects: [{ type: 'damage', element: 'ice', value: 10, description: 'Steam explosion' }, { type: 'damage', element: 'fire', value: 9, description: 'Heat wave' }], icon: 'game-icons:fire-wave', tier: 2 } },
];

// ---- PROCEDURAL SPELL NAMING (R-v5.19) ----
const ELEMENT_PREFIXES: Record<string, string[]> = {
  fire: ['Blaze', 'Inferno', 'Scorch', 'Ember', 'Pyro'],
  ice: ['Frost', 'Glacial', 'Cryo', 'Rime', 'Tundra'],
  nature: ['Vine', 'Thorn', 'Bloom', 'Root', 'Wild'],
  shadow: ['Void', 'Umbral', 'Nether', 'Dark', 'Abyss'],
  arcane: ['Prismatic', 'Arcane', 'Crystal', 'Ether', 'Astral'],
};
const SUFFIXES = ['Strike', 'Burst', 'Wave', 'Storm', 'Bolt', 'Blast', 'Surge', 'Pulse', 'Nova', 'Cascade'];

export function generateSpellName(elements: string[], tier: number): string {
  const prefix = ELEMENT_PREFIXES[elements[0]][Math.min(tier - 1, 4)];
  if (elements.length > 1) {
    const modifier = ELEMENT_PREFIXES[elements[1]][Math.min(tier - 1, 4)];
    return `${modifier} ${prefix}`;
  }
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}
