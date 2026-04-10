// ============================================================
// Event-driven scene renderer (R-v5.21)
// ============================================================

import { emit } from './events';

type SceneRenderer = () => void;
const scenes: Record<string, SceneRenderer> = {};
let currentSceneName = '';

export function registerScene(name: string, render: SceneRenderer): void {
  scenes[name] = render;
}

export function renderScene(name: string): void {
  currentSceneName = name;
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = '';

  if (scenes[name]) {
    scenes[name]();
  } else {
    app.innerHTML = `<div class="scene-error">Unknown scene: ${name}</div>`;
  }

  emit('scene-changed', name);
}

export function getCurrentSceneName(): string {
  return currentSceneName;
}

export function refreshScene(): void {
  if (currentSceneName) {
    renderScene(currentSceneName);
  }
}

// Helper to create an iconify-icon element
export function icon(name: string, size = 24): string {
  return `<iconify-icon icon="${name}" width="${size}" height="${size}"></iconify-icon>`;
}

// Helper to create a progress bar
export function bar(current: number, max: number, color: string, label?: string, height = 18): string {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return `
    <div class="bar-container" style="height:${height}px">
      <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
      <div class="bar-text">${label || `${current}/${max}`}</div>
    </div>
  `;
}

// Helper: element color
export function elementColor(el: string): string {
  const colors: Record<string, string> = {
    fire: '#ff6b35', ice: '#4fc3f7', nature: '#66bb6a', shadow: '#9c27b0', arcane: '#ffd54f',
  };
  return colors[el] || '#aaa';
}

// Helper: room type icon
export function roomTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    combat: 'game-icons:crossed-swords', elite: 'game-icons:skull-crossed-bones',
    forge: 'game-icons:anvil', rest: 'game-icons:campfire', event: 'game-icons:scroll-unfurled',
    merchant: 'game-icons:trade', boss: 'game-icons:boss-key', training: 'game-icons:target-dummy',
  };
  return icons[type] || 'game-icons:dungeon-gate';
}
