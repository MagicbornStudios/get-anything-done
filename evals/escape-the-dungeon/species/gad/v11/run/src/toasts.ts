// Toast notification system — transient, auto-dismiss (R-v5.10)

import { bus, EVT } from './events';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

bus.on(EVT.TOAST, (toast: { id: number; text: string; type: string }) => {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${toast.type}`;
  el.textContent = toast.text;
  el.dataset.toastId = String(toast.id);
  c.appendChild(el);

  // Auto-dismiss
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 3500);
});
