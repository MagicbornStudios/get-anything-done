// Rune definitions for the forge system
export interface Rune {
  id: string;
  name: string;
  symbol: string;
  element: SpellElement;
  description: string;
}

export type SpellElement = "fire" | "ice" | "lightning" | "poison" | "arcane" | "holy";

export const RUNES: Rune[] = [
  { id: "rune_ignis", name: "Ignis", symbol: "🔥", element: "fire", description: "Essence of flame" },
  { id: "rune_glacius", name: "Glacius", symbol: "❄️", element: "ice", description: "Essence of frost" },
  { id: "rune_fulgur", name: "Fulgur", symbol: "⚡", element: "lightning", description: "Essence of storm" },
  { id: "rune_venenum", name: "Venenum", symbol: "🧪", element: "poison", description: "Essence of toxin" },
  { id: "rune_arcanum", name: "Arcanum", symbol: "✨", element: "arcane", description: "Essence of pure magic" },
];

// Spell effect types
export type SpellEffectType = "damage" | "dot" | "heal" | "buff" | "debuff" | "shield";

export interface SpellEffect {
  type: SpellEffectType;
  element: SpellElement;
  power: number;        // base damage/heal amount
  duration?: number;    // for DoT/buffs
  description: string;
}

export interface SpellRecipe {
  runes: [string, string]; // two rune IDs
  spellName: string;
  manaCost: number;
  effects: SpellEffect[];
  description: string;
  icon: string;
}

// All valid forge combinations
export const SPELL_RECIPES: SpellRecipe[] = [
  {
    runes: ["rune_ignis", "rune_ignis"],
    spellName: "Inferno Blast",
    manaCost: 12,
    effects: [{ type: "damage", element: "fire", power: 35, description: "Massive fire damage" }],
    description: "Concentrated fire explosion",
    icon: "🌋",
  },
  {
    runes: ["rune_ignis", "rune_venenum"],
    spellName: "Toxic Flame",
    manaCost: 10,
    effects: [
      { type: "damage", element: "fire", power: 15, description: "Fire damage" },
      { type: "dot", element: "poison", power: 8, duration: 3, description: "Poison burn for 3 turns" },
    ],
    description: "Burns with toxic fire, dealing damage over time",
    icon: "🔥",
  },
  {
    runes: ["rune_glacius", "rune_glacius"],
    spellName: "Frozen Lance",
    manaCost: 11,
    effects: [
      { type: "damage", element: "ice", power: 28, description: "Ice damage" },
      { type: "debuff", element: "ice", power: 3, duration: 2, description: "Slows enemy for 2 turns" },
    ],
    description: "A lance of pure ice that slows the target",
    icon: "🧊",
  },
  {
    runes: ["rune_glacius", "rune_arcanum"],
    spellName: "Arcane Frost",
    manaCost: 14,
    effects: [
      { type: "damage", element: "arcane", power: 22, description: "Arcane damage" },
      { type: "debuff", element: "ice", power: 5, duration: 2, description: "Reduces defense" },
    ],
    description: "Mystical cold that weakens defenses",
    icon: "💠",
  },
  {
    runes: ["rune_fulgur", "rune_fulgur"],
    spellName: "Thunder Strike",
    manaCost: 13,
    effects: [{ type: "damage", element: "lightning", power: 40, description: "Massive lightning damage" }],
    description: "Pure concentrated lightning",
    icon: "⛈️",
  },
  {
    runes: ["rune_fulgur", "rune_arcanum"],
    spellName: "Arcane Bolt",
    manaCost: 8,
    effects: [{ type: "damage", element: "arcane", power: 25, description: "Arcane lightning damage" }],
    description: "Quick arcane-infused bolt — good against physical-resistant foes",
    icon: "🔮",
  },
  {
    runes: ["rune_venenum", "rune_venenum"],
    spellName: "Plague Cloud",
    manaCost: 9,
    effects: [{ type: "dot", element: "poison", power: 12, duration: 4, description: "Heavy poison for 4 turns" }],
    description: "A cloud of deadly poison — bypasses armor",
    icon: "☠️",
  },
  {
    runes: ["rune_venenum", "rune_arcanum"],
    spellName: "Hex Venom",
    manaCost: 11,
    effects: [
      { type: "damage", element: "poison", power: 15, description: "Poison damage" },
      { type: "dot", element: "arcane", power: 6, duration: 3, description: "Arcane decay" },
    ],
    description: "Cursed venom that erodes from within",
    icon: "💜",
  },
  {
    runes: ["rune_arcanum", "rune_arcanum"],
    spellName: "Mana Surge",
    manaCost: 6,
    effects: [
      { type: "damage", element: "arcane", power: 20, description: "Pure arcane damage" },
      { type: "heal", element: "arcane", power: 8, description: "Restores 8 mana" },
    ],
    description: "Pure arcane energy — damages foes, restores mana",
    icon: "⭐",
  },
  {
    runes: ["rune_ignis", "rune_glacius"],
    spellName: "Thermal Shock",
    manaCost: 12,
    effects: [
      { type: "damage", element: "fire", power: 18, description: "Fire damage" },
      { type: "damage", element: "ice", power: 18, description: "Ice damage" },
    ],
    description: "Extreme temperature shift — dual element, hard to resist both",
    icon: "🌡️",
  },
  {
    runes: ["rune_ignis", "rune_fulgur"],
    spellName: "Storm Fire",
    manaCost: 14,
    effects: [
      { type: "damage", element: "fire", power: 20, description: "Fire damage" },
      { type: "damage", element: "lightning", power: 20, description: "Lightning damage" },
    ],
    description: "Lightning-charged flames",
    icon: "🔱",
  },
  {
    runes: ["rune_ignis", "rune_arcanum"],
    spellName: "Soul Flame",
    manaCost: 10,
    effects: [
      { type: "damage", element: "arcane", power: 30, description: "Arcane fire that ignores physical defense" },
    ],
    description: "Ethereal flame that bypasses armor",
    icon: "👻",
  },
  {
    runes: ["rune_glacius", "rune_fulgur"],
    spellName: "Frost Storm",
    manaCost: 13,
    effects: [
      { type: "damage", element: "ice", power: 16, description: "Ice damage" },
      { type: "damage", element: "lightning", power: 16, description: "Lightning damage" },
      { type: "debuff", element: "ice", power: 2, duration: 1, description: "Brief stun" },
    ],
    description: "Icy lightning storm",
    icon: "🌊",
  },
  {
    runes: ["rune_glacius", "rune_venenum"],
    spellName: "Cryo Toxin",
    manaCost: 10,
    effects: [
      { type: "damage", element: "ice", power: 12, description: "Ice damage" },
      { type: "dot", element: "poison", power: 10, duration: 3, description: "Frozen poison for 3 turns" },
    ],
    description: "Slowing poison that seeps through armor",
    icon: "🥶",
  },
  {
    runes: ["rune_fulgur", "rune_venenum"],
    spellName: "Shock Toxin",
    manaCost: 11,
    effects: [
      { type: "damage", element: "lightning", power: 18, description: "Lightning damage" },
      { type: "dot", element: "poison", power: 7, duration: 3, description: "Electrified poison" },
    ],
    description: "Electrically charged venom",
    icon: "💛",
  },
];

// Find recipe by two rune IDs (order doesn't matter)
export function findRecipe(runeA: string, runeB: string): SpellRecipe | undefined {
  return SPELL_RECIPES.find(
    (r) =>
      (r.runes[0] === runeA && r.runes[1] === runeB) ||
      (r.runes[0] === runeB && r.runes[1] === runeA)
  );
}
