import type { Rune, Spell, DamageType, StatusEffect } from "../types";

// 5 runes -- pressure-oriented design: starter spells are direct damage only,
// crafted spells unlock DoT / summon / drain, which are required to beat bosses.
export const RUNES: Rune[] = [
  {
    id: "rune_pyr",
    name: "Pyr",
    icon: "game-icons:flame",
    type: "element",
    element: "fire",
    desc: "The ember rune. Burns linger.",
  },
  {
    id: "rune_kry",
    name: "Kry",
    icon: "game-icons:frozen-orb",
    type: "element",
    element: "cold",
    desc: "The frost rune. Chills slow and sting.",
  },
  {
    id: "rune_zep",
    name: "Zep",
    icon: "game-icons:lightning-tree",
    type: "element",
    element: "shock",
    desc: "The storm rune. Arcs of unstable power.",
  },
  {
    id: "rune_tox",
    name: "Tox",
    icon: "game-icons:poison-cloud",
    type: "element",
    element: "poison",
    desc: "The blight rune. Festers in the veins.",
  },
  {
    id: "rune_umb",
    name: "Umb",
    icon: "game-icons:daemon-skull",
    type: "force",
    element: "arcane",
    desc: "The umbral rune. Drains and binds.",
  },
];

// Starter spells -- direct damage only. Intentionally insufficient to handle
// floor 1 boss (Stone Warden resists physical & direct) or floor 2 boss
// (Pyre Lich reflects direct fire). Player MUST craft.
export const STARTER_SPELLS: Spell[] = [
  {
    id: "spell_arcane_bolt",
    name: "Arcane Bolt",
    icon: "game-icons:magic-swirl",
    cost: 3,
    damage: 6,
    damageType: "arcane",
    kind: "direct",
    desc: "A basic apprentice spell. Direct arcane damage.",
  },
  {
    id: "spell_spark",
    name: "Spark",
    icon: "game-icons:spark-spirit",
    cost: 2,
    damage: 4,
    damageType: "shock",
    kind: "direct",
    desc: "A weak shock jolt. Reliable and cheap.",
  },
];

// Authored combos. Order-independent lookup by sorted key.
// Each produces a qualitatively different spell kind (DoT / summon / drain)
// so at least one clears each pressure encounter.
interface ComboRecipe {
  a: string;
  b: string;
  spell: Omit<Spell, "runes">;
}

export const COMBOS: ComboRecipe[] = [
  {
    a: "rune_pyr",
    b: "rune_tox",
    spell: {
      id: "spell_wildfire",
      name: "Wildfire",
      icon: "game-icons:burning-embers",
      cost: 5,
      damage: 3,
      damageType: "fire",
      kind: "dot",
      status: { effect: "burn", turns: 4, magnitude: 4 },
      desc: "Ignites flesh. 4 turns of burn. Bypasses physical resist.",
    },
  },
  {
    a: "rune_kry",
    b: "rune_tox",
    spell: {
      id: "spell_venom_frost",
      name: "Venom Frost",
      icon: "game-icons:acid",
      cost: 5,
      damage: 4,
      damageType: "poison",
      kind: "dot",
      status: { effect: "poison", turns: 5, magnitude: 3 },
      desc: "Corrosive chill. 5 turns of poison.",
    },
  },
  {
    a: "rune_zep",
    b: "rune_umb",
    spell: {
      id: "spell_void_storm",
      name: "Void Storm",
      icon: "game-icons:crystal-ball",
      cost: 6,
      damage: 8,
      damageType: "arcane",
      kind: "summon",
      desc: "Indirect arcane. Bypasses reflect — the storm is the caster.",
    },
  },
  {
    a: "rune_umb",
    b: "rune_tox",
    spell: {
      id: "spell_soul_drain",
      name: "Soul Drain",
      icon: "game-icons:vampire-cape",
      cost: 4,
      damage: 5,
      damageType: "arcane",
      kind: "drain",
      desc: "Drains HP from foe. Heals caster for half damage dealt.",
    },
  },
  {
    a: "rune_pyr",
    b: "rune_zep",
    spell: {
      id: "spell_plasma_lance",
      name: "Plasma Lance",
      icon: "game-icons:fire-bolt",
      cost: 5,
      damage: 11,
      damageType: "fire",
      kind: "direct",
      desc: "Superheated bolt. Strong but direct — reflects hurt.",
    },
  },
  {
    a: "rune_kry",
    b: "rune_zep",
    spell: {
      id: "spell_sleet_shock",
      name: "Sleet Shock",
      icon: "game-icons:ice-bomb",
      cost: 5,
      damage: 6,
      damageType: "cold",
      kind: "dot",
      status: { effect: "chill", turns: 3, magnitude: 2 },
      desc: "Frozen conduction. Chills and drains agility.",
    },
  },
];

export function comboKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

const COMBO_MAP: Record<string, ComboRecipe> = (() => {
  const m: Record<string, ComboRecipe> = {};
  for (const c of COMBOS) m[comboKey(c.a, c.b)] = c;
  return m;
})();

// Ingenuity clause (decision etd-02): any unknown pair still produces a valid
// spell by folding the two runes' element and form. This preserves the pressure
// that forge is NEVER a dead end.
function foldRunes(a: Rune, b: Rune): Omit<Spell, "runes"> {
  const elem: DamageType = a.element ?? b.element ?? "arcane";
  const cost = 4;
  const damage = 5;
  // Status depends on elem
  const statusMap: Partial<Record<DamageType, { effect: StatusEffect; turns: number; magnitude: number }>> = {
    fire: { effect: "burn", turns: 3, magnitude: 2 },
    cold: { effect: "chill", turns: 3, magnitude: 2 },
    shock: { effect: "shock", turns: 2, magnitude: 3 },
    poison: { effect: "poison", turns: 4, magnitude: 2 },
  };
  return {
    id: `spell_ingenuity_${a.id}_${b.id}`,
    name: `${a.name}-${b.name} Ingenuity`,
    icon: "game-icons:magic-palm",
    cost,
    damage,
    damageType: elem,
    kind: statusMap[elem] ? "dot" : "direct",
    status: statusMap[elem],
    desc: `An improvised ${a.name}+${b.name} working. Minor ${elem} with chance of lingering effect.`,
  };
}

export function craftSpell(runeAId: string, runeBId: string): Spell {
  const key = comboKey(runeAId, runeBId);
  const authored = COMBO_MAP[key];
  const runeA = RUNES.find((r) => r.id === runeAId)!;
  const runeB = RUNES.find((r) => r.id === runeBId)!;
  const base = authored ? authored.spell : foldRunes(runeA, runeB);
  return { ...base, runes: [runeAId, runeBId] };
}

export function runeById(id: string): Rune | undefined {
  return RUNES.find((r) => r.id === id);
}
