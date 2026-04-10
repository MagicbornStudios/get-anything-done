// ============================================================
// Rest Scene (R-v5.11)
// ============================================================

import { registerScene, renderScene, icon, bar } from '../renderer';
import { getState, getCurrentRoom, saveGame, getEffectiveStats } from '../state';
import { emit } from '../events';

registerScene('rest', () => {
  const app = document.getElementById('app')!;
  const s = getState();
  const room = getCurrentRoom();
  const stats = getEffectiveStats();

  app.innerHTML = `
    <div class="scene rest-scene">
      <div class="scene-header">
        <h2>${icon('game-icons:campfire', 28)} ${room.name}</h2>
      </div>
      <div class="rest-panel">
        <p>${room.description}</p>
        <div class="rest-status">
          <div class="rest-bars">
            ${bar(s.player.stats.hp, stats.maxHp, '#e53935', `HP ${s.player.stats.hp}/${stats.maxHp}`)}
            ${bar(s.player.stats.mana, stats.maxMana, '#1e88e5', `MP ${s.player.stats.mana}/${stats.maxMana}`)}
            ${bar(s.player.stats.stamina, stats.maxStamina, '#43a047', `SP ${s.player.stats.stamina}/${stats.maxStamina}`)}
          </div>
        </div>
        <div class="rest-actions">
          <button class="btn btn-primary" id="btn-rest">
            ${icon('game-icons:night-sleep', 20)} Rest (Restore 60% HP/MP/SP)
          </button>
          <button class="btn btn-secondary" id="btn-loadout">
            ${icon('game-icons:spell-book', 20)} Change Loadout
          </button>
          ${room.npc ? `
            <button class="btn btn-secondary" id="btn-talk-npc">
              ${icon(room.npc.icon, 20)} Talk to ${room.npc.name}
            </button>
          ` : ''}
          <button class="btn btn-secondary" id="btn-back-map">
            ${icon('game-icons:return-arrow', 16)} Leave
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-rest')?.addEventListener('click', () => {
    // Restore 60% of max (not full — R-v5.11 "limited recovery")
    s.player.stats.hp = Math.min(stats.maxHp, s.player.stats.hp + Math.floor(stats.maxHp * 0.6));
    s.player.stats.mana = Math.min(stats.maxMana, s.player.stats.mana + Math.floor(stats.maxMana * 0.6));
    s.player.stats.stamina = Math.min(stats.maxStamina, s.player.stats.stamina + Math.floor(stats.maxStamina * 0.6));
    emit('toast', 'You rest and recover your strength.', 'success');
    emit('state-changed');
    saveGame();
    renderScene('rest');
  });

  document.getElementById('btn-loadout')?.addEventListener('click', () => {
    s.currentScene = 'loadout';
    renderScene('loadout');
  });

  document.getElementById('btn-talk-npc')?.addEventListener('click', () => {
    s.currentScene = 'dialogue';
    renderScene('dialogue');
  });

  document.getElementById('btn-back-map')?.addEventListener('click', () => {
    room.cleared = true;
    s.currentScene = 'map'; saveGame(); renderScene('map');
  });
});
