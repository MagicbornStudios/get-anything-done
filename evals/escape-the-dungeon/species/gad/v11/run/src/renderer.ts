// ============================================================
// DOM-based scene renderer — event-driven (R-v5.21)
// No per-tick redraws. Only re-renders on state events.
// ============================================================

import { bus, EVT } from './events';

type SceneRenderer = (container: HTMLElement) => void;
type SceneCleanup = () => void;

const scenes: Map<string, { render: SceneRenderer; cleanup?: SceneCleanup }> = new Map();
let currentCleanup: SceneCleanup | null = null;

export function registerScene(name: string, render: SceneRenderer, cleanup?: SceneCleanup): void {
  scenes.set(name, { render, cleanup });
}

export function renderScene(name: string): void {
  const app = document.getElementById('app')!;
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  app.innerHTML = '';
  const scene = scenes.get(name);
  if (!scene) {
    app.innerHTML = `<div style="color:red;padding:20px;">Unknown scene: ${name}</div>`;
    return;
  }
  scene.render(app);
  currentCleanup = scene.cleanup || null;
}

// Listen for scene changes
bus.on(EVT.SCENE_CHANGE, (sceneName: string) => {
  renderScene(sceneName);
});

// ---- Helper: create element with attributes ----
export function el(tag: string, attrs: Record<string, any> = {}, ...children: (string | HTMLElement)[]): HTMLElement {
  const elem = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') elem.className = val;
    else if (key === 'onclick') elem.addEventListener('click', val);
    else if (key === 'style' && typeof val === 'object') Object.assign(elem.style, val);
    else if (key.startsWith('data-')) elem.setAttribute(key, val);
    else elem.setAttribute(key, val);
  }
  for (const child of children) {
    if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
    else elem.appendChild(child);
  }
  return elem;
}

export function icon(name: string, cls: string = ''): HTMLElement {
  const ic = document.createElement('iconify-icon');
  ic.setAttribute('icon', name);
  if (cls) ic.className = cls;
  return ic;
}

export function barHTML(current: number, max: number, cssClass: string, label?: string): HTMLElement {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const container = el('div', { className: `bar-container ${cssClass}` },
    el('div', { className: 'bar-fill', style: { width: `${pct}%` } }),
    el('div', { className: 'bar-label' }, label || `${current}/${max}`),
  );
  return container;
}
