// ============================================================
// Forge Scene — Spell Crafting (R-v5.01, R-v5.02, R-v5.19, R-v5.20)
// ============================================================

import { registerScene, renderScene, icon, bar, elementColor } from '../renderer';
import { getState, saveGame } from '../state';
import { emit } from '../events';
import { SPELL_RECIPES, generateSpellName } from '../data';
import type { Rune, Spell } from '../types';

let selectedIngredients: string[] = [];

function findMatchingRecipe(ingredients: string[]): typeof SPELL_RECIPES[0] | null {
  const sorted = [...ingredients].sort();
  return SPELL_RECIPES.find(r => {
    const recipeSorted = [...r.ingredients].sort();
    return recipeSorted.length === sorted.length && recipeSorted.every((ing, i) => ing === sorted[i]);
  }) || null;
}

function craftSpell(): void {
  const s = getState();
  const recipe = findMatchingRecipe(selectedIngredients);

  if (!recipe) {
    // No matching recipe — create a custom spell from ingredients
    emit('toast', 'No known recipe for this combination!', 'warning');
    return;
  }

  // Check unique ingredients (R-v5.20)
  const uniqueCheck = new Set(selectedIngredients);
  if (uniqueCheck.size !== selectedIngredients.length) {
    emit('toast', 'Each ingredient must be unique!', 'warning');
    return;
  }

  // Create the spell
  const newSpell: Spell = {
    id: `spell-crafted-${Date.now()}`,
    name: recipe.result.name,
    elements: recipe.result.elements as Spell['elements'],
    runeIds: selectedIngredients.filter(id => id.startsWith('rune-')),
    power: recipe.result.power,
    manaCost: recipe.result.manaCost,
    effects: recipe.result.effects.map(e => ({ ...e })),
    icon: recipe.result.icon,
    tier: recipe.result.tier,
    ingredients: [...selectedIngredients],
  };

  // Check if spell used an existing spell as ingredient (R-v5.19 — consume it)
  for (const ingId of selectedIngredients) {
    if (ingId.startsWith('spell-')) {
      const spellIdx = s.player.spells.findIndex(sp => sp.id === ingId);
      if (spellIdx >= 0) {
        // Remove from loadout if equipped
        s.player.spellLoadout = s.player.spellLoadout.map(id => id === ingId ? null : id);
        s.player.spells.splice(spellIdx, 1);
        emit('toast', `Consumed spell as ingredient`, 'info');
      }
    }
  }

  s.player.spells.push(newSpell);

  // Auto-equip if there's a free loadout slot
  const freeSlot = s.player.spellLoadout.indexOf(null);
  if (freeSlot >= 0) {
    s.player.spellLoadout[freeSlot] = newSpell.id;
  }

  emit('toast', `Crafted: ${newSpell.name}!`, 'success');
  selectedIngredients = [];
  saveGame();
  emit('state-changed');
  renderScene('forge');
}

registerScene('forge', () => {
  const app = document.getElementById('app')!;
  const s = getState();

  const discoveredRunes = s.player.runes.filter(r => r.discovered);
  const allRunes = s.player.runes;

  // Build rune display
  const runeHtml = allRunes.map(r => {
    const isSelected = selectedIngredients.includes(r.id);
    const isDisabled = !r.discovered || (isSelected ? false : selectedIngredients.includes(r.id));
    return `
      <div class="forge-ingredient ${r.discovered ? '' : 'undiscovered'} ${isSelected ? 'selected' : ''}"
           data-ingredient-id="${r.id}" data-type="rune">
        <div class="ingredient-icon" style="color:${elementColor(r.element)}">${icon(r.icon, 32)}</div>
        <div class="ingredient-name">${r.discovered ? r.name : '???'}</div>
        ${r.discovered ? `
          <div class="ingredient-affinity">
            ${bar(r.affinityLevel, 100, elementColor(r.element), `Affinity: ${r.affinityLevel}`, 12)}
            ${r.affinityMilestones.map(m => `
              <div class="milestone ${m.claimed ? 'claimed' : ''} ${r.affinityLevel >= m.level ? 'reached' : ''}">
                ${m.level}: ${m.reward}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Spell ingredients (R-v5.19)
  const spellHtml = s.player.spells.map(sp => {
    const isSelected = selectedIngredients.includes(sp.id);
    return `
      <div class="forge-ingredient spell-ingredient ${isSelected ? 'selected' : ''}"
           data-ingredient-id="${sp.id}" data-type="spell">
        <div class="ingredient-icon" style="color:${elementColor(sp.elements[0])}">${icon(sp.icon, 28)}</div>
        <div class="ingredient-name">${sp.name} (T${sp.tier})</div>
      </div>
    `;
  }).join('');

  // Recipe preview
  const recipe = findMatchingRecipe(selectedIngredients);
  const previewHtml = recipe ? `
    <div class="recipe-preview">
      <h4>${icon(recipe.result.icon, 24)} ${recipe.result.name}</h4>
      <div class="recipe-elements">${recipe.result.elements.map(el => `<span style="color:${elementColor(el)}">${el}</span>`).join(' + ')}</div>
      <div class="recipe-power">Power: ${recipe.result.power} | Cost: ${recipe.result.manaCost} MP</div>
      <div class="recipe-effects">${recipe.result.effects.map(e => `<div class="effect">${e.description}</div>`).join('')}</div>
    </div>
  ` : selectedIngredients.length >= 2 ? `
    <div class="recipe-preview unknown">
      <p>No known recipe for this combination.</p>
    </div>
  ` : `
    <div class="recipe-preview empty">
      <p>Select 2 ingredients to see recipe preview.</p>
    </div>
  `;

  app.innerHTML = `
    <div class="scene forge-scene">
      <div class="scene-header">
        <h2>${icon('game-icons:anvil', 28)} The Forge</h2>
        <button class="btn btn-secondary" id="btn-back-map">${icon('game-icons:return-arrow', 16)} Back to Map</button>
      </div>

      <div class="forge-layout">
        <div class="forge-ingredients">
          <h3>Runes</h3>
          <div class="ingredient-grid">${runeHtml}</div>
          <h3>Spells (as ingredients)</h3>
          <div class="ingredient-grid">${spellHtml}</div>
        </div>

        <div class="forge-crafting">
          <h3>Crafting Station</h3>
          <div class="selected-ingredients">
            ${selectedIngredients.map(id => {
              const rune = s.player.runes.find(r => r.id === id);
              const spell = s.player.spells.find(sp => sp.id === id);
              const name = rune?.name || spell?.name || id;
              const ic = rune?.icon || spell?.icon || 'game-icons:cog';
              return `<span class="selected-pill" data-remove-id="${id}">${icon(ic, 16)} ${name} &times;</span>`;
            }).join('')}
          </div>
          ${previewHtml}
          <button class="btn btn-primary ${selectedIngredients.length < 2 || !recipe ? 'disabled' : ''}" id="btn-craft">
            ${icon('game-icons:anvil-impact', 20)} Craft Spell
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind ingredient selection
  app.querySelectorAll('.forge-ingredient:not(.undiscovered)').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.ingredientId!;
      const idx = selectedIngredients.indexOf(id);
      if (idx >= 0) {
        selectedIngredients.splice(idx, 1);
      } else if (selectedIngredients.length < 3 && !selectedIngredients.includes(id)) {
        selectedIngredients.push(id);
      }
      renderScene('forge');
    });
  });

  // Remove selected
  app.querySelectorAll('.selected-pill').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.removeId!;
      selectedIngredients = selectedIngredients.filter(i => i !== id);
      renderScene('forge');
    });
  });

  // Craft button
  document.getElementById('btn-craft')?.addEventListener('click', () => {
    if (selectedIngredients.length >= 2 && recipe) craftSpell();
  });

  // Back button
  document.getElementById('btn-back-map')?.addEventListener('click', () => {
    const room = s.floors.find(f => f.id === s.player.currentFloor)?.rooms.find(r => r.id === s.player.currentRoomId);
    if (room) room.cleared = true;
    selectedIngredients = [];
    s.currentScene = 'map';
    saveGame();
    renderScene('map');
  });
});
