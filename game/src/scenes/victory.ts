// ============================================================
// Victory Scene
// ============================================================

import { registerScene, renderScene, icon } from '../renderer';
import { getState, deleteSave } from '../state';

registerScene('victory', () => {
  const app = document.getElementById('app')!;
  const s = getState();
  const elapsed = Date.now() - s.player.gameClockStart;
  const mins = Math.floor(elapsed / 60000);

  app.innerHTML = `
    <div class="scene victory-scene">
      <div class="victory-content">
        ${icon('game-icons:laurel-crown', 80)}
        <h1>You Escaped the Dungeon!</h1>
        <p>The Lich King has been defeated. The dungeon crumbles as light floods the depths.</p>
        <div class="victory-stats">
          <div class="victory-stat">${icon('game-icons:person', 20)} Level ${s.player.stats.level}</div>
          <div class="victory-stat">${icon('game-icons:spell-book', 20)} ${s.player.spells.length} spells learned</div>
          <div class="victory-stat">${icon('game-icons:fire-ring', 20)} ${s.player.discoveredRunes.length} runes discovered</div>
          <div class="victory-stat">${icon('game-icons:coins', 20)} ${s.player.gold} gold collected</div>
          <div class="victory-stat">${icon('game-icons:sundial', 20)} ${mins} minutes played</div>
        </div>
        <button class="btn btn-primary btn-large" id="btn-new-game">${icon('game-icons:sword-brandish', 24)} Play Again</button>
      </div>
    </div>
  `;

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    deleteSave();
    renderScene('title');
  });
});
