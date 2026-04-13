/**
 * External append-only log for ClientDebugShell. Updates go through
 * useSyncExternalStore so appends never call React setState from console.* (avoids #185).
 */

export type DebugLineKind =
  | "window"
  | "rejection"
  | "react"
  | "console-error"
  | "console-warn"
  | "console-log";

export type DebugLine = {
  t: number;
  kind: DebugLineKind;
  message: string;
  detail?: string;
};

const MAX = 200;

let lines: readonly DebugLine[] = [];
const listeners = new Set<() => void>();
let emitScheduled = false;

function pushToWindowExport(line: DebugLine) {
  if (typeof window === "undefined") return;
  const w = window as Window & { __GAD_DEBUG_LINES?: DebugLine[] };
  const prev = w.__GAD_DEBUG_LINES ?? [];
  w.__GAD_DEBUG_LINES = [...prev.slice(-199), line];
}

function scheduleEmit() {
  if (emitScheduled) return;
  emitScheduled = true;
  queueMicrotask(() => {
    emitScheduled = false;
    for (const l of listeners) l();
  });
}

export function subscribeDebugLog(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getDebugLogSnapshot(): readonly DebugLine[] {
  return lines;
}

export function getServerDebugLogSnapshot(): readonly DebugLine[] {
  return [];
}

export function appendDebugLog(line: DebugLine): void {
  lines = [...lines.slice(-(MAX - 1)), line];
  pushToWindowExport(line);
  scheduleEmit();
}

export function clearDebugLog(): void {
  lines = [];
  if (typeof window !== "undefined") {
    (window as Window & { __GAD_DEBUG_LINES?: DebugLine[] }).__GAD_DEBUG_LINES = [];
  }
  scheduleEmit();
}
