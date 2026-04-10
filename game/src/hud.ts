// ============================================================
// Persistent HUD (R-v5.12, R-v5.17)
// ============================================================

import { on } from './events';
import { getState, getEffectiveStats } from './state';
import { bar, icon } from './renderer';

const NON_HUD_SCENES = ['title', 'victory'];

export function setupHUDListeners(): void {
  on('scene-changed', renderHUD);
  on('state-changed', () => {
    // Only re-render HUD if we're on a scene that shows it
    try {
      const s = getState();
      if (!NON_HUD_SCENES.includes(s.currentScene)) {
        renderHUD(s.currentScene);
      }
    } catch { /* game not started */ }
  });
}

function getGameTime(): string {
  try {
    const s = getState();
    const elapsed = Date.now() - s.player.gameClockStart;
    const hours = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);
    const dayPhase = hours % 24 < 6 ? 'Night' : hours % 24 < 12 ? 'Morning' : hours % 24 < 18 ? 'Afternoon' : 'Evening';
    return `Day ${Math.floor(hours / 24) + 1} — ${dayPhase} (${hours}h ${mins}m)`;
  } catch {
    return '';
  }
}

function renderHUD(sceneName?: string): void {
  const hud = document.getElementById('hud');
  if (!hud) return;

  if (NON_HUD_SCENES.includes(sceneName || '')) {
    hud.classList.add('hidden');
    return;
  }

  let s: ReturnType<typeof getState>;
  try { s = getState(); } catch { hud.classList.add('hidden'); return; }

  hud.classList.remove('hidden');
  const stats = getEffectiveStats();

  hud.innerHTML = `
    <div class="hud-row">
      <div class="hud-name">${icon('game-icons:person', 20)} ${s.player.name} <span class="hud-level">Lv.${stats.level}</span></div>
      <div class="hud-floor">${icon('game-icons:stairs', 18)} Floor ${s.player.currentFloor}</div>
      <div class="hud-gold">${icon('game-icons:coins', 18)} ${s.player.gold}g</div>
      <div class="hud-time">${icon('game-icons:sundial', 18)} ${getGameTime()}</div>
      <div class="hud-xp">${bar(s.player.stats.xp, s.player.stats.xpToLevel, '#ffd54f', `XP ${s.player.stats.xp}/${s.player.stats.xpToLevel}`, 14)}</div>
    </div>
    <div class="hud-row hud-bars">
      <div class="hud-bar-group">
        <span class="hud-bar-label">${icon('game-icons:hearts', 16)} HP</span>
        ${bar(s.player.stats.hp, stats.maxHp, '#e53935')}
      </div>
      <div class="hud-bar-group">
        <span class="hud-bar-label">${icon('game-icons:spell-book', 16)} Mana</span>
        ${bar(s.player.stats.mana, stats.maxMana, '#1e88e5')}
      </div>
      <div class="hud-bar-group">
        <span class="hud-bar-label">${icon('game-icons:running-shoe', 16)} Stam</span>
        ${bar(s.player.stats.stamina, stats.maxStamina, '#43a047')}
      </div>
    </div>
    <div class="hud-row hud-nav-buttons">
      <button class="hud-btn" data-scene="map">${icon('game-icons:treasure-map', 16)} Map</button>
      <button class="hud-btn" data-scene="inventory">${icon('game-icons:knapsack', 16)} Bag</button>
      <button class="hud-btn" data-scene="character">${icon('game-icons:character-sheet', 16)} Stats</button>
      <button class="hud-btn" data-scene="loadout">${icon('game-icons:spell-book', 16)} Loadout</button>
    </div>
  `;

  // Bind nav buttons (use dynamic import to avoid circular deps)
  hud.querySelectorAll('.hud-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scene = (btn as HTMLElement).dataset.scene;
      if (scene) {
        const { renderScene } = await import('./renderer');
        s.currentScene = scene;
        renderScene(scene);
      }
    });
  });
}
