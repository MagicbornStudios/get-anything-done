import { registerScene, el, icon } from '../renderer';
import { getState, deleteSave, setScene } from '../state';

registerScene('victory', (container) => {
  const state = getState();
  const p = state.player;

  const screen = el('div', { className: 'title-screen' },
    icon('game-icons:trophy', 'icon-xxl'),
    el('h1', { style: { background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-heal))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } }, 'ESCAPE COMPLETE!'),
    el('p', { className: 'subtitle' }, 'You have conquered the dungeon.'),
    el('div', { className: 'panel', style: { maxWidth: '400px', textAlign: 'center' } },
      el('h3', {}, 'Final Stats'),
      el('p', {}, `Level: ${p.stats.level}`),
      el('p', {}, `Spells Crafted: ${p.spells.length - 2}`),
      el('p', {}, `Runes Discovered: ${p.discoveredRunes.length}`),
      el('p', {}, `Gold: ${p.gold}`),
      el('p', {}, `Traits: ${Object.entries(p.traits).map(([k, v]) => `${k}: ${(v as number).toFixed(2)}`).join(', ')}`),
    ),
    el('div', { className: 'title-buttons', style: { marginTop: '16px' } },
      el('button', {
        className: 'btn btn-primary',
        onclick: () => {
          deleteSave();
          setScene('title');
        },
      }, 'Return to Title'),
    ),
  );

  container.appendChild(screen);
});
