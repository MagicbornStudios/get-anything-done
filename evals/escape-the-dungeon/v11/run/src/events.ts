// Event bus for event-driven rendering (R-v5.21)
// All UI updates go through events — no per-tick redraws

type Listener = (...args: any[]) => void;

class EventBus {
  private listeners: Map<string, Set<Listener>> = new Map();

  on(event: string, fn: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }

  once(event: string, fn: Listener) {
    const unsub = this.on(event, (...args) => {
      unsub();
      fn(...args);
    });
    return unsub;
  }
}

export const bus = new EventBus();

// Event types
export const EVT = {
  // Scene
  SCENE_CHANGE: 'scene:change',
  // Game state
  STATE_UPDATE: 'state:update',
  PLAYER_UPDATE: 'player:update',
  // Combat
  COMBAT_START: 'combat:start',
  COMBAT_ACTION: 'combat:action',
  COMBAT_END: 'combat:end',
  COMBAT_PAUSE: 'combat:pause',
  COMBAT_RESUME: 'combat:resume',
  // Map
  ROOM_ENTER: 'room:enter',
  ROOM_CLEAR: 'room:clear',
  FLOOR_CHANGE: 'floor:change',
  // Forge
  SPELL_CRAFTED: 'spell:crafted',
  RUNE_DISCOVERED: 'rune:discovered',
  AFFINITY_CHANGE: 'affinity:change',
  // Inventory
  ITEM_GAINED: 'item:gained',
  ITEM_USED: 'item:used',
  EQUIP_CHANGE: 'equip:change',
  // Traits
  TRAIT_SHIFT: 'trait:shift',
  // Dialogue
  DIALOGUE_START: 'dialogue:start',
  DIALOGUE_CHOICE: 'dialogue:choice',
  // Toast
  TOAST: 'toast:show',
  // Save
  SAVE: 'save:checkpoint',
  // Clock
  CLOCK_TICK: 'clock:tick',
} as const;
