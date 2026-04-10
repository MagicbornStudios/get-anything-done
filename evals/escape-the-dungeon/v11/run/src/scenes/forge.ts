import { registerScene, el, icon, barHTML } from '../renderer';
import { getState, addSpell, showToast, setScene, saveGame } from '../state';
import { createHUD } from '../hud';
import { craftSpell } from '../data';
import type { Rune, Spell } from '../types';

registerScene('forge', (container) => {
  const state = getState();
  const p = state.player;
  let selectedIngredients: string[] = [];
  let craftResult: Spell | null = null;

  container.appendChild(createHUD());

  const scene = el('div', { className: 'forge-scene' });

  function renderForge() {
    scene.innerHTML = '';

    const main = el('div', { className: 'forge-main' });

    // Header
    main.appendChild(el('div', { className: 'panel-header' },
      el('h2', {}, icon('game-icons:anvil', 'icon-lg'), ' Spell Forge'),
      el('button', { className: 'btn btn-sm', onclick: () => setScene('map') }, 'Back to Map'),
    ));

    // Ingredient slots
    main.appendChild(el('h3', {}, 'Selected Ingredients (2+ required, unique only)'));
    const slots = el('div', { className: 'forge-ingredients' });
    for (let i = 0; i < 4; i++) {
      const ingId = selectedIngredients[i];
      const rune = ingId ? p.runes.find(r => r.id === ingId) : null;
      const spell = ingId && !rune ? p.spells.find(s => s.id === ingId) : null;

      const slot = el('div', {
        className: `forge-slot ${ingId ? 'filled' : ''}`,
        onclick: () => {
          if (ingId) {
            selectedIngredients.splice(i, 1);
            craftResult = null;
            renderForge();
          }
        },
      });

      if (rune) {
        slot.appendChild(icon(rune.icon));
        slot.appendChild(el('span', { style: { fontSize: '10px' } }, rune.name));
      } else if (spell) {
        slot.appendChild(icon(spell.icon));
        slot.appendChild(el('span', { style: { fontSize: '10px' } }, spell.name));
      } else {
        slot.appendChild(el('span', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `Slot ${i + 1}`));
      }
      slots.appendChild(slot);
    }
    main.appendChild(slots);

    // Craft button
    if (selectedIngredients.length >= 2) {
      const previewSpell = craftSpell(selectedIngredients, p.runes, p.spells);
      if (previewSpell) {
        main.appendChild(el('div', { className: 'forge-result' },
          icon(previewSpell.icon, 'icon-lg'),
          el('div', {},
            el('strong', {}, previewSpell.name),
            el('p', { style: { fontSize: '12px', color: 'var(--text-dim)' } },
              `Power: ${previewSpell.power} | Mana: ${previewSpell.manaCost} | Elements: ${previewSpell.elements.join(', ')}`),
            el('p', { style: { fontSize: '11px' } },
              previewSpell.effects.map(e => e.description).join('; ')),
          ),
        ));
        main.appendChild(el('button', {
          className: 'btn btn-primary',
          style: { marginTop: '8px' },
          onclick: () => {
            const newSpell = craftSpell(selectedIngredients, p.runes, p.spells);
            if (newSpell) {
              addSpell(newSpell);
              showToast(`Crafted: ${newSpell.name}!`, 'success');
              selectedIngredients = [];
              craftResult = null;
              saveGame();
              renderForge();
            }
          },
        }, icon('game-icons:anvil-impact', 'icon-sm'), 'Forge Spell'));
      } else {
        main.appendChild(el('p', { style: { color: 'var(--hp-bar)', fontSize: '12px' } },
          'Invalid combination — ensure unique ingredients'));
      }
    }

    // Available runes
    main.appendChild(el('h3', { style: { marginTop: '16px' } }, 'Available Runes'));
    const runeGrid = el('div', { className: 'rune-grid' });
    for (const rune of p.runes) {
      const isSelected = selectedIngredients.includes(rune.id);
      const card = el('div', {
        className: `rune-card ${isSelected ? 'selected' : ''} ${!rune.discovered ? 'locked' : ''}`,
        onclick: () => {
          if (!rune.discovered) return;
          if (isSelected) {
            selectedIngredients = selectedIngredients.filter(id => id !== rune.id);
          } else if (selectedIngredients.length < 4 && !selectedIngredients.includes(rune.id)) {
            selectedIngredients.push(rune.id);
          }
          renderForge();
        },
      },
        icon(rune.discovered ? rune.icon : 'game-icons:locked-chest'),
        el('span', { className: `rune-name elem-${rune.element}` }, rune.discovered ? rune.name : '???'),
        rune.discovered ? el('span', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `Affinity: ${rune.affinityLevel}`) : el('span', {}),
      );
      runeGrid.appendChild(card);
    }
    main.appendChild(runeGrid);

    // Available spells (as ingredients — R-v5.19)
    if (p.spells.length > 0) {
      main.appendChild(el('h3', { style: { marginTop: '16px' } }, 'Spells (usable as ingredients)'));
      const spellGrid = el('div', { className: 'rune-grid' });
      for (const spell of p.spells) {
        const isSelected = selectedIngredients.includes(spell.id);
        const card = el('div', {
          className: `rune-card ${isSelected ? 'selected' : ''}`,
          onclick: () => {
            if (isSelected) {
              selectedIngredients = selectedIngredients.filter(id => id !== spell.id);
            } else if (selectedIngredients.length < 4 && !selectedIngredients.includes(spell.id)) {
              selectedIngredients.push(spell.id);
            }
            renderForge();
          },
        },
          icon(spell.icon),
          el('span', { className: 'rune-name' }, spell.name),
          el('span', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, `T${spell.tier} | ${spell.elements.join(',')}`),
        );
        spellGrid.appendChild(card);
      }
      main.appendChild(spellGrid);
    }

    // Affinity display
    main.appendChild(el('h3', { style: { marginTop: '16px' } }, 'Rune Affinities'));
    for (const rune of p.runes.filter(r => r.discovered)) {
      const row = el('div', { className: 'affinity-row' },
        el('div', { className: 'affinity-icon' }, icon(rune.icon, 'icon-sm')),
        el('span', { className: `elem-${rune.element}`, style: { minWidth: '80px', fontSize: '12px' } }, rune.name),
        el('div', { className: 'affinity-bar', style: { flex: '1' } },
          barHTML(rune.affinityLevel, 100, 'bar-xp', `${rune.affinityLevel}/100`),
        ),
      );

      // Milestones
      for (const ms of rune.affinityMilestones) {
        row.appendChild(el('span', {
          className: 'affinity-milestone',
          style: { opacity: ms.claimed ? '1' : '0.5', marginLeft: '8px' },
        }, `${ms.level}: ${ms.claimed ? '✓ ' : ''}${ms.reward}`));
      }

      main.appendChild(row);
    }

    scene.appendChild(main);
  }

  renderForge();
  container.appendChild(scene);
});
