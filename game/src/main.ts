// ============================================================
// Escape the Dungeon — Main Entry (v12 GAD Eval)
// ============================================================

import 'iconify-icon';
import './styles.css';
import './events';
import './toasts';
import { renderScene } from './renderer';
import { setupHUDListeners } from './hud';

// Register all scenes
import './scenes/title';
import './scenes/map';
import './scenes/combat';
import './scenes/forge';
import './scenes/dialogue';
import './scenes/merchant';
import './scenes/rest';
import './scenes/character';
import './scenes/inventory';
import './scenes/loadout';
import './scenes/victory';

function boot() {
  setupHUDListeners();
  renderScene('title');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
