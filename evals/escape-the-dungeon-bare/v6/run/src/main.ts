import 'iconify-icon';
import { injectStyles } from './ui/styles';
import { render, setupKeyboardShortcuts } from './ui/renderer';
import { setState, subscribe, loadGame, createNewGameState, getState } from './state';

// Initialize
injectStyles();

// Set up event-driven rendering
subscribe(() => {
  // Use requestAnimationFrame to batch renders
  requestAnimationFrame(() => render());
});

// Always start at title screen
const titleState = createNewGameState();
titleState.screen = 'title';
setState(titleState);

setupKeyboardShortcuts();

// Notification cleanup timer (event-driven, not per-tick)
setInterval(() => {
  const state = getState();
  if (state && state.notifications.length > 0) {
    const now = Date.now();
    const before = state.notifications.length;
    state.notifications = state.notifications.filter(n => n.expires > now);
    if (state.notifications.length !== before) {
      requestAnimationFrame(() => render());
    }
  }
}, 1000);
