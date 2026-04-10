// ============================================================
// Title Screen Scene
// ============================================================

import { registerScene, renderScene, icon } from '../renderer';
import { hasSave, newGame, loadGame } from '../state';

registerScene('title', () => {
  const app = document.getElementById('app')!;
  const hasContinue = hasSave();

  app.innerHTML = `
    <div class="scene title-scene">
      <div class="title-logo">
        ${icon('game-icons:dungeon-gate', 80)}
        <h1>Escape the Dungeon</h1>
        <p class="title-subtitle">Forge your path. Craft your power. Survive.</p>
      </div>
      <div class="title-menu">
        <button class="btn btn-primary btn-large" id="btn-new-game">
          ${icon('game-icons:sword-brandish', 24)} New Game
        </button>
        ${hasContinue ? `
          <button class="btn btn-secondary btn-large" id="btn-continue">
            ${icon('game-icons:save', 24)} Continue
          </button>
        ` : ''}
      </div>
      <div class="title-footer">
        <p>A roguelike dungeon crawler — v12 GAD Eval</p>
      </div>
    </div>
  `;

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    const s = newGame();
    s.currentScene = 'map';
    renderScene('map');
  });

  document.getElementById('btn-continue')?.addEventListener('click', () => {
    const s = loadGame();
    if (s) {
      s.currentScene = 'map';
      renderScene('map');
    }
  });
});
