// ============================================================
// Event-driven rendering bus (R-v5.21)
// No per-tick redraws — all UI updates are event-driven
// ============================================================

type EventHandler = (...args: any[]) => void;

const listeners: Record<string, EventHandler[]> = {};

export function on(event: string, handler: EventHandler): void {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(handler);
}

export function off(event: string, handler: EventHandler): void {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(h => h !== handler);
}

export function emit(event: string, ...args: any[]): void {
  if (!listeners[event]) return;
  for (const handler of listeners[event]) {
    handler(...args);
  }
}
