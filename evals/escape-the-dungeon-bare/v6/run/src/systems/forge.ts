import { GameState, Spell, ElementType, Rune } from '../types';
import { updateState } from '../state';
import { generateSpellName, calculateSpellDamage, calculateManaCost } from '../data/runes';

export function getAvailableRunes(state: GameState): Rune[] {
  return state.player.discoveredRunes.filter(r => r.discovered);
}

export function getAvailableSpellsAsIngredients(state: GameState): Spell[] {
  return state.player.knownSpells.filter(s => s.affinity >= 10); // Need some affinity to use as ingredient
}

export function craftSpell(
  selectedRuneIds: string[],
  selectedSpellId: string | null,
  state: GameState
): Spell | null {
  // Validate: unique runes only
  if (new Set(selectedRuneIds).size !== selectedRuneIds.length) return null;
  if (selectedRuneIds.length < 1) return null;

  const runes = selectedRuneIds
    .map(id => state.player.discoveredRunes.find(r => r.id === id && r.discovered))
    .filter((r): r is Rune => r !== null);

  if (runes.length === 0) return null;

  const elements: ElementType[] = runes.map(r => r.element);

  // If using a spell as ingredient
  let baseSpellName: string | undefined;
  if (selectedSpellId) {
    const baseSpell = state.player.knownSpells.find(s => s.id === selectedSpellId);
    if (baseSpell) {
      baseSpellName = baseSpell.name;
      // Add the base spell's elements
      for (const el of baseSpell.elements) {
        if (!elements.includes(el)) elements.push(el);
      }
    }
  }

  const name = generateSpellName(elements, baseSpellName);
  const damage = calculateSpellDamage(elements, state.player.affinities);
  const manaCost = calculateManaCost(elements);

  // Determine effect based on element combo
  let effect: Spell['effect'] = undefined;
  if (elements.includes('fire') && elements.includes('nature')) {
    effect = { type: 'dot', value: Math.floor(damage * 0.3), duration: 3 };
  } else if (elements.includes('ice') && elements.includes('shadow')) {
    effect = { type: 'stun', value: 1, duration: 1 };
  } else if (elements.includes('nature') && elements.includes('arcane')) {
    effect = { type: 'heal', value: Math.floor(damage * 0.6) };
  } else if (elements.includes('lightning') && elements.includes('fire')) {
    effect = { type: 'burst', value: Math.floor(damage * 0.4) };
  } else if (elements.includes('shadow') && elements.includes('arcane')) {
    effect = { type: 'drain', value: Math.floor(damage * 0.3) };
  } else if (elements.includes('ice') && elements.length > 1) {
    effect = { type: 'debuff', value: 3, duration: 2 };
  } else if (elements.includes('fire')) {
    effect = { type: 'dot', value: Math.floor(damage * 0.2), duration: 2 };
  } else if (elements.includes('nature')) {
    effect = { type: 'heal', value: Math.floor(damage * 0.4) };
  }

  const newSpell: Spell = {
    id: 'spell-crafted-' + Math.random().toString(36).slice(2, 8),
    name,
    elements,
    runeIds: selectedRuneIds,
    damage: effect?.type === 'heal' ? 0 : damage,
    manaCost,
    effect,
    affinity: 0,
    isCrafted: true,
    ingredients: [...selectedRuneIds, ...(selectedSpellId ? [selectedSpellId] : [])],
  };

  return newSpell;
}

export function addCraftedSpell(spell: Spell): void {
  updateState(state => {
    state.player.knownSpells.push(spell);
    // Auto-equip to first empty slot
    const emptyIdx = state.player.equippedSpells.findIndex(s => s === null);
    if (emptyIdx !== -1) {
      state.player.equippedSpells[emptyIdx] = spell;
    }
    state.notifications.push({
      text: `Crafted: ${spell.name} (${spell.elements.join('+')}${spell.effect ? ' - ' + spell.effect.type : ''})!`,
      type: 'reward',
      id: state.nextNotifId++,
      expires: Date.now() + 5000,
    });
  });
}

export function getAffinityRewards(element: ElementType, level: number): string[] {
  const rewards: string[] = [];
  if (level >= 15) rewards.push(`${element} spells deal +2 damage`);
  if (level >= 30) rewards.push(`Unlock ${element} combo recipes`);
  if (level >= 50) rewards.push(`${element} spells cost -1 mana`);
  if (level >= 75) rewards.push(`${element} DoT/effects +50% duration`);
  if (level >= 100) rewards.push(`Master of ${element}: all bonuses doubled`);
  return rewards;
}
