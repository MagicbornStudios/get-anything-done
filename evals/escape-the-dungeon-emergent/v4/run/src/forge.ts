import type { ContentData } from "./content";
import type { GameState, Spell } from "./types";

export function findCombo(content: ContentData, inputs: string[]): Spell | null {
  if (inputs.length !== 2) return null;
  const sorted = [...inputs].sort().join(",");
  for (const combo of content.combinations) {
    const comboSorted = [...(combo.inputs || [])].sort().join(",");
    if (comboSorted === sorted) return combo;
  }
  return null;
}

export function craftSpell(state: GameState, content: ContentData, inputs: string[]): { ok: boolean; spell?: Spell; reason?: string } {
  const combo = findCombo(content, inputs);
  if (!combo) return { ok: false, reason: "Those runes don't combine." };
  if (state.player.spellbook.some((s) => s.id === combo.id)) {
    return { ok: false, reason: "You already know this spell." };
  }
  const cost = 5;
  if (state.player.crystals < cost) return { ok: false, reason: `Needs ${cost} crystals.` };
  state.player.crystals -= cost;
  const spell: Spell = { ...combo, crafted: true };
  state.player.spellbook.push(spell);
  const floorKey = `${state.currentFloor}`;
  state.floorForgeUseCount[floorKey] = (state.floorForgeUseCount[floorKey] || 0) + 1;
  // Affinity gain
  for (const r of inputs) {
    state.player.runeAffinity[r] = (state.player.runeAffinity[r] || 0) + 1;
  }
  return { ok: true, spell };
}

export function trainAffinity(state: GameState, runeId: string): { ok: boolean; reason?: string } {
  const xpCost = 10;
  if (state.player.xp < xpCost) return { ok: false, reason: `Needs ${xpCost} XP.` };
  state.player.xp -= xpCost;
  state.player.runeAffinity[runeId] = (state.player.runeAffinity[runeId] || 0) + 2;
  return { ok: true };
}
