"use client";

/**
 * Module-level store for the Visual Context modifier chord (Alt / Ctrl|Meta / Shift).
 *
 * Why not React context: a context value change re-renders every consumer. `Identified`
 * subscribes to `useDevId()` for highlight / ring state and would re-render on every
 * modifier keydown/keyup if the chord lived in that context. On pages with dozens or
 * hundreds of `Identified` wrappers, pressing Ctrl would trigger a full-tree re-render.
 *
 * This store is consumed via `useVcChord()` → `useSyncExternalStore`, so ONLY components
 * that explicitly read the chord re-render when it changes. `Identified` and other
 * non-chord consumers stay still.
 *
 * The single global listener set is installed lazily when the first subscriber mounts
 * and torn down when the last subscriber unmounts (so SSR / unused pages pay nothing).
 */

import { useSyncExternalStore } from "react";
import {
  VC_CHORD_IDLE,
  attachVcChordGlobalListeners,
  type VcChordModifiers,
} from "./modifiers";

type Listener = () => void;

const listeners = new Set<Listener>();
let snapshot: VcChordModifiers = VC_CHORD_IDLE;
let detachGlobal: (() => void) | null = null;

/**
 * Object identity is swapped on every change so `useSyncExternalStore` correctly
 * detects update. Callers compare by field, not by reference.
 */
function publish(next: VcChordModifiers): void {
  if (
    next.alt === snapshot.alt &&
    next.ctrl === snapshot.ctrl &&
    next.shift === snapshot.shift
  ) {
    return;
  }
  snapshot = next;
  for (const l of listeners) l();
}

function ensureAttached(): void {
  if (detachGlobal || typeof window === "undefined") return;
  detachGlobal = attachVcChordGlobalListeners(publish);
}

function teardownIfIdle(): void {
  if (listeners.size > 0) return;
  if (detachGlobal) {
    detachGlobal();
    detachGlobal = null;
  }
  // Reset to idle so the next subscriber starts clean (blurs / tab-away missed events).
  snapshot = VC_CHORD_IDLE;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  ensureAttached();
  return () => {
    listeners.delete(listener);
    teardownIfIdle();
  };
}

function getSnapshot(): VcChordModifiers {
  return snapshot;
}

function getServerSnapshot(): VcChordModifiers {
  return VC_CHORD_IDLE;
}

/**
 * Subscribe to the live Visual Context modifier chord. Returns the current
 * `VcChordModifiers` snapshot; the component re-renders only when alt / ctrl / shift
 * actually change. Safe to call anywhere (SSR returns the idle snapshot).
 */
export function useVcChord(): VcChordModifiers {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Read the current chord without subscribing (for imperative handlers). */
export function peekVcChord(): VcChordModifiers {
  return snapshot;
}
