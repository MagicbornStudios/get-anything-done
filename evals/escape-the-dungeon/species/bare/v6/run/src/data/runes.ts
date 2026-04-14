import { Rune } from '../types';

export const ALL_RUNES: Rune[] = [
  { id: 'rune-fire', name: 'Ignis Rune', element: 'fire', description: 'Burns with inner flame. Base element for fire spells.', discovered: true },
  { id: 'rune-ice', name: 'Glacius Rune', element: 'ice', description: 'Cold as the void between stars. Base for ice spells.', discovered: true },
  { id: 'rune-lightning', name: 'Voltus Rune', element: 'lightning', description: 'Crackles with raw energy. Base for lightning spells.', discovered: false },
  { id: 'rune-shadow', name: 'Umbra Rune', element: 'shadow', description: 'Absorbs light around it. Base for shadow spells.', discovered: false },
  { id: 'rune-nature', name: 'Verdis Rune', element: 'nature', description: 'Pulses with living energy. Base for nature spells.', discovered: false },
  { id: 'rune-arcane', name: 'Arcanum Rune', element: 'arcane', description: 'Pure magical essence. Base for arcane spells.', discovered: false },
];

// Spell naming system - procedural but semantic
const ELEMENT_ROOTS: Record<string, string[]> = {
  fire: ['Flame', 'Ember', 'Blaze', 'Pyre', 'Scorch'],
  ice: ['Frost', 'Glacial', 'Chill', 'Sleet', 'Rime'],
  lightning: ['Spark', 'Thunder', 'Volt', 'Storm', 'Arc'],
  shadow: ['Shadow', 'Void', 'Dusk', 'Umbral', 'Eclipse'],
  nature: ['Thorn', 'Bloom', 'Vine', 'Root', 'Verdant'],
  arcane: ['Arcane', 'Ether', 'Mystic', 'Astral', 'Aether'],
};

const ELEMENT_SUFFIXES: Record<string, string[]> = {
  fire: ['fall', 'burst', 'wave', 'strike', 'storm'],
  ice: ['snap', 'bite', 'shard', 'lance', 'wall'],
  lightning: ['bolt', 'crack', 'surge', 'chain', 'flash'],
  shadow: ['grasp', 'veil', 'pulse', 'mark', 'drain'],
  nature: ['spike', 'wrap', 'bloom', 'seed', 'mend'],
  arcane: ['ray', 'nova', 'orb', 'weave', 'surge'],
};

const COMBO_MODIFIERS: Record<string, Record<string, string>> = {
  fire: { ice: 'Frostfall', lightning: 'Thunderflame', shadow: 'Darkfire', nature: 'Wildfire', arcane: 'Starfire' },
  ice: { fire: 'Meltwater', lightning: 'Frostbolt', shadow: 'Blackice', nature: 'Winterbloom', arcane: 'Crystal' },
  lightning: { fire: 'Firestorm', ice: 'Shockfrost', shadow: 'Darkstorm', nature: 'Stormroot', arcane: 'Sparkweave' },
  shadow: { fire: 'Shadowflame', ice: 'Darkfrost', lightning: 'Nightstrike', nature: 'Blight', arcane: 'Voidweave' },
  nature: { fire: 'Ashbloom', ice: 'Frostbloom', lightning: 'Thundervine', shadow: 'Rotwood', arcane: 'Lifespark' },
  arcane: { fire: 'Sunfire', ice: 'Moonbeam', lightning: 'Starshock', shadow: 'Voidbeam', nature: 'Spiritbloom' },
};

export function generateSpellName(elements: string[], baseSpellName?: string): string {
  if (elements.length === 0) return 'Unknown Spell';
  if (elements.length === 1) {
    const el = elements[0];
    const roots = ELEMENT_ROOTS[el] || ['Magic'];
    const suffixes = ELEMENT_SUFFIXES[el] || ['bolt'];
    const ri = Math.floor(Math.random() * roots.length);
    const si = Math.floor(Math.random() * suffixes.length);
    return `${roots[ri]}${suffixes[si]}`;
  }
  // Two elements: use combo modifier
  const [a, b] = elements;
  const modifier = COMBO_MODIFIERS[a]?.[b] || COMBO_MODIFIERS[b]?.[a] || 'Primal';
  const suffixes = ELEMENT_SUFFIXES[b] || ELEMENT_SUFFIXES[a] || ['bolt'];
  const si = Math.floor(Math.random() * suffixes.length);

  if (baseSpellName) {
    // Evolving from an existing spell
    const prefixes = ['Greater', 'Grand', 'Ascended', 'True', 'Ancient'];
    const pi = Math.floor(Math.random() * prefixes.length);
    return `${prefixes[pi]} ${modifier}`;
  }
  return `${modifier} ${suffixes[si].charAt(0).toUpperCase() + suffixes[si].slice(1)}`;
}

export function calculateSpellDamage(elements: string[], affinities: Record<string, number>): number {
  let base = 8;
  for (const el of elements) {
    base += 4;
    const aff = affinities[el] || 0;
    base += Math.floor(aff / 20) * 2; // +2 per 20 affinity
  }
  return base;
}

export function calculateManaCost(elements: string[]): number {
  return 5 + elements.length * 3;
}
