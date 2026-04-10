import { registerScene, el, icon, barHTML } from '../renderer';
import { getState, healPlayer, showToast, setScene, saveGame } from '../state';
import { createHUD } from '../hud';

registerScene('rest', (container) => {
  const state = getState();
  const p = state.player;
  const s = p.stats;
  let hasRested = false;

  container.appendChild(createHUD());

  const scene = el('div', { className: 'rest-scene' });

  function renderRest() {
    scene.innerHTML = '';

    scene.appendChild(icon('game-icons:camp-fire', 'icon-xxl'));
    scene.appendChild(el('h2', {}, 'Rest Room'));
    scene.appendChild(el('p', { style: { color: 'var(--text-dim)', maxWidth: '400px', textAlign: 'center', lineHeight: '1.5' } },
      'A quiet alcove with a natural spring. Rest here to recover a portion of your health, mana, and stamina. You may also adjust your loadout.'));

    // Current stats
    scene.appendChild(el('div', { style: { width: '300px', display: 'flex', flexDirection: 'column', gap: '6px', margin: '16px 0' } },
      barHTML(s.hp, s.maxHp, 'bar-hp', `HP ${s.hp}/${s.maxHp}`),
      barHTML(s.mana, s.maxMana, 'bar-mana', `MP ${s.mana}/${s.maxMana}`),
      barHTML(s.stamina, s.maxStamina, 'bar-stamina', `SP ${s.stamina}/${s.maxStamina}`),
    ));

    const buttons = el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' } });

    if (!hasRested) {
      buttons.appendChild(el('button', {
        className: 'btn btn-primary',
        onclick: () => {
          // Heal 50% of max (not full — R-v5.11 says limited recovery)
          const hpHeal = Math.floor(s.maxHp * 0.5);
          const mpHeal = Math.floor(s.maxMana * 0.5);
          const spHeal = s.maxStamina; // Full stamina restore
          healPlayer(hpHeal, mpHeal, spHeal);
          showToast(`Rested! +${hpHeal} HP, +${mpHeal} MP, full SP`, 'success');
          hasRested = true;
          saveGame();
          renderRest();
        },
      }, icon('game-icons:camp-fire', 'icon-sm'), 'Rest'));
    } else {
      scene.appendChild(el('p', { style: { color: 'var(--accent-heal)' } }, 'You feel refreshed.'));
    }

    buttons.appendChild(el('button', {
      className: 'btn',
      onclick: () => setScene('loadout'),
    }, icon('game-icons:spell-book', 'icon-sm'), 'Manage Loadout'));

    buttons.appendChild(el('button', {
      className: 'btn',
      onclick: () => setScene('map'),
    }, icon('game-icons:treasure-map', 'icon-sm'), 'Back to Map'));

    scene.appendChild(buttons);
  }

  renderRest();
  container.appendChild(scene);
});
