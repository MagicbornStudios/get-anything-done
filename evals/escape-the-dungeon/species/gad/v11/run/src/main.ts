// ============================================================
// Escape the Dungeon — Main Entry
// v11 GAD Eval
// ============================================================

// Import iconify-icon web component
import 'iconify-icon';

// Event system
import './events';
import './toasts';

// Renderer
import { renderScene } from './renderer';

// State
import { getState, hasSave } from './state';

// HUD
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

// Boot
function boot() {
  setupHUDListeners();
  renderScene('title');
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
