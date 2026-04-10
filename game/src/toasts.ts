// ============================================================
// Transient toast notification system (R-v5.10)
// ============================================================

import type { ToastMessage } from './types';
import { on } from './events';

let toastId = 0;
const activeToasts: ToastMessage[] = [];

function renderToasts(): void {
  const container = document.getElementById('toasts');
  if (!container) return;

  container.innerHTML = activeToasts.map(t => `
    <div class="toast toast-${t.type}" data-toast-id="${t.id}">
      ${t.text}
      <button class="toast-dismiss" onclick="this.parentElement.remove()">&times;</button>
    </div>
  `).join('');
}

export function showToast(text: string, type: ToastMessage['type'] = 'info', duration = 4000): void {
  const toast: ToastMessage = {
    id: ++toastId,
    text,
    type,
    timestamp: Date.now(),
  };
  activeToasts.push(toast);
  renderToasts();

  setTimeout(() => {
    const idx = activeToasts.findIndex(t => t.id === toast.id);
    if (idx >= 0) {
      activeToasts.splice(idx, 1);
      renderToasts();
    }
  }, duration);
}

// Listen for toast events
on('toast', (text: string, type?: ToastMessage['type']) => {
  showToast(text, type || 'info');
});

on('trait-shift', (trait: string, delta: number) => {
  const sign = delta > 0 ? '+' : '';
  showToast(`${sign}${delta.toFixed(2)} ${trait}`, 'trait', 3000);
});
