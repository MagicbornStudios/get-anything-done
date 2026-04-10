import { registerScene, el, icon } from '../renderer';
import { newGame, loadGame, hasSave, setScene, getState } from '../state';

registerScene('title', (container) => {
  const canContinue = hasSave();

  const screen = el('div', { className: 'title-screen' },
    icon('game-icons:dungeon-gate', 'icon-xxl'),
    el('h1', {}, 'Escape the Dungeon'),
    el('p', { className: 'subtitle' }, 'Craft. Adapt. Survive.'),
    el('div', { className: 'title-buttons' },
      el('button', {
        className: 'btn btn-primary',
        onclick: () => newGame(),
      }, icon('game-icons:sword-brandish', 'icon-sm'), 'New Game'),
      ...(canContinue ? [
        el('button', {
          className: 'btn',
          onclick: () => {
            loadGame();
            const state = getState();
            setScene(state.currentScene === 'title' ? 'map' : state.currentScene);
          },
        }, icon('game-icons:save', 'icon-sm'), 'Continue'),
      ] : []),
    ),
    el('div', { style: { marginTop: '32px', color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' } },
      'A roguelike dungeon crawler. Craft spells from runes, build your loadout, and let combat auto-resolve based on your preparation. The dungeon demands ingenuity — brute force will not suffice.',
    ),
  );

  container.appendChild(screen);
});
