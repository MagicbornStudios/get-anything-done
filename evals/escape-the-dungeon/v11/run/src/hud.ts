// HUD — persistent top bar with HP/mana/stamina, floor, gold, clock

import { el, icon, barHTML } from './renderer';
import { getState, getGameClock, setScene } from './state';
import { bus, EVT } from './events';

export function createHUD(): HTMLElement {
  const state = getState();
  const p = state.player;
  const s = p.stats;
  const clock = getGameClock();

  const hud = el('div', { className: 'hud' },
    // Player name + level
    el('div', { className: 'hud-section' },
      icon('game-icons:knight-banner', 'icon-sm'),
      el('span', { style: { fontWeight: '600', color: '#fff' } }, `${p.name} Lv.${s.level}`),
    ),
    // Resource bars
    el('div', { className: 'hud-bars' },
      el('div', { className: 'hud-bar-wrap' },
        barHTML(s.hp, s.maxHp, 'bar-hp', `HP ${s.hp}/${s.maxHp}`),
      ),
      el('div', { className: 'hud-bar-wrap' },
        barHTML(s.mana, s.maxMana, 'bar-mana', `MP ${s.mana}/${s.maxMana}`),
      ),
      el('div', { className: 'hud-bar-wrap' },
        barHTML(s.stamina, s.maxStamina, 'bar-stamina', `SP ${s.stamina}/${s.maxStamina}`),
      ),
      el('div', { className: 'hud-bar-wrap' },
        barHTML(s.xp, s.xpToLevel, 'bar-xp', `XP ${s.xp}/${s.xpToLevel}`),
      ),
    ),
    // Stats
    el('div', { className: 'hud-section', style: { gap: '10px' } },
      el('span', { className: 'hud-stat' },
        icon('game-icons:tower', 'icon-sm'),
        el('span', {}, 'Floor '),
        el('span', { className: 'value' }, `${p.currentFloor}`),
      ),
      el('span', { className: 'hud-stat' },
        icon('game-icons:two-coins', 'icon-sm'),
        el('span', { className: 'value' }, `${p.gold}`),
      ),
      el('span', { className: 'hud-stat' },
        icon(clock.dayNight === 'day' ? 'game-icons:sun' : 'game-icons:moon-bats', 'icon-sm'),
        el('span', { className: 'value' }, `${String(clock.hours).padStart(2, '0')}:${String(clock.minutes).padStart(2, '0')}`),
      ),
    ),
    // Nav buttons
    el('div', { className: 'hud-nav-btns' },
      el('button', { className: 'btn btn-sm', onclick: () => setScene('map') },
        icon('game-icons:treasure-map', 'icon-sm'), 'Map'),
      el('button', { className: 'btn btn-sm', onclick: () => setScene('character') },
        icon('game-icons:character', 'icon-sm'), 'Stats'),
      el('button', { className: 'btn btn-sm', onclick: () => setScene('inventory') },
        icon('game-icons:knapsack', 'icon-sm'), 'Bag'),
      el('button', { className: 'btn btn-sm', onclick: () => setScene('loadout') },
        icon('game-icons:spell-book', 'icon-sm'), 'Loadout'),
    ),
  );

  return hud;
}

// Update HUD on player changes
export function setupHUDListeners(): void {
  const updateHUD = () => {
    const existing = document.querySelector('.hud');
    if (existing) {
      const parent = existing.parentElement;
      const newHud = createHUD();
      parent?.replaceChild(newHud, existing);
    }
  };
  bus.on(EVT.PLAYER_UPDATE, updateHUD);
}
