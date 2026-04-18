"use client";

/**
 * Module-level store for `Identified` selection state: highlight + Alt-merge lane +
 * Ctrl/Cmd reference lane + flash-on-locate.
 *
 * Why not React state / context: `Identified` instances mount in the hundreds on a
 * busy page. If selection lives in `DevIdSelectionContext`, every state change
 * re-renders every `Identified` — even those whose selection didn't change — because
 * they all read `sameDepthMergeCids` / `ctrlLaneCids` to call `.includes(cid)`.
 *
 * With this store + `useSyncExternalStore`, each `Identified` subscribes to **its own
 * boolean**: `useIsInCtrlLane(cid)`, `useIsInAltMerge(cid)`, `useIsHighlighted(cid)`,
 * `useIsFlashing(cid)`. An `Identified` only re-renders when ITS membership changes —
 * not when ANY selection changes anywhere on the page.
 *
 * `DevIdSelectionContext` still exists as a legacy façade for panels that want the
 * full selection object (tool toolbars, dialogs); those are few and re-render rarely.
 * Writes always go through this store — the context consumers read via
 * `useSelectionSnapshot()`.
 */

import { useSyncExternalStore } from "react";

export interface SelectionState {
  highlightCid: string | null;
  /** Alt-lane: primary handoff group (Alt+click). Arrays stay small; `.includes` is O(n) on tiny n. */
  sameDepthMergeCids: readonly string[];
  /** Ctrl/Cmd-lane: cross-depth reference targets. */
  ctrlLaneCids: readonly string[];
  flashCid: string | null;
}

const IDLE: SelectionState = Object.freeze({
  highlightCid: null,
  sameDepthMergeCids: Object.freeze([]) as readonly string[],
  ctrlLaneCids: Object.freeze([]) as readonly string[],
  flashCid: null,
});

let state: SelectionState = IDLE;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function peekSelection(): SelectionState {
  return state;
}

/** Full-snapshot hook for the legacy `useDevIdSelection()` consumers. */
export function useSelectionSnapshot(): SelectionState {
  return useSyncExternalStore(subscribe, peekSelection, () => IDLE);
}

export function setHighlightCid(cid: string | null): void {
  if (state.highlightCid === cid) return;
  state = { ...state, highlightCid: cid };
  notify();
}

export function setFlashCid(cid: string | null): void {
  if (state.flashCid === cid) return;
  state = { ...state, flashCid: cid };
  notify();
}

export function setSameDepthMergeCids(
  next: readonly string[] | ((prev: readonly string[]) => readonly string[]),
): void {
  const resolved = typeof next === "function" ? next(state.sameDepthMergeCids) : next;
  if (resolved === state.sameDepthMergeCids) return;
  state = { ...state, sameDepthMergeCids: resolved };
  notify();
}

export function setCtrlLaneCids(
  next: readonly string[] | ((prev: readonly string[]) => readonly string[]),
): void {
  const resolved = typeof next === "function" ? next(state.ctrlLaneCids) : next;
  if (resolved === state.ctrlLaneCids) return;
  state = { ...state, ctrlLaneCids: resolved };
  notify();
}

/** Batch reset used on Escape / clear-all. Fires a single notify. */
export function clearAllSelection(): void {
  if (
    state.highlightCid === null &&
    state.sameDepthMergeCids.length === 0 &&
    state.ctrlLaneCids.length === 0 &&
    state.flashCid === null
  ) {
    return;
  }
  state = IDLE;
  notify();
}

/**
 * Alt-click / Alt-row: flip a single leaf into the primary highlight and the
 * same-depth merge lane in ONE store mutation. Previously this was two React
 * setters (`setHighlightCid` + `setSameDepthMergeCids`) which fired two
 * subscriber passes — and on a page with 200 `Identified` that's two render
 * passes where one would do. `computeMergeCids` is `leaf`-pure so callers
 * don't need to read the store directly.
 */
export function altPickLeaf(
  cid: string,
  computeMergeCids: (prev: readonly string[]) => readonly string[],
): void {
  const nextMerge = computeMergeCids(state.sameDepthMergeCids);
  const highlightChanged = state.highlightCid !== cid;
  const mergeChanged = nextMerge !== state.sameDepthMergeCids;
  if (!highlightChanged && !mergeChanged) return;
  state = {
    ...state,
    highlightCid: cid,
    sameDepthMergeCids: nextMerge,
  };
  notify();
}

/**
 * Plain click (no modifier): make `cid` the sole selection — clears the Ctrl
 * reference lane, collapses the Alt merge lane to `[cid]`, sets highlight.
 * Three-field flip in one notify (vs three separate store writes / three
 * subscriber passes on every row click).
 */
export function selectLeaf(cid: string): void {
  const nextMerge: readonly string[] = [cid];
  const highlightChanged = state.highlightCid !== cid;
  const mergeChanged =
    state.sameDepthMergeCids.length !== 1 || state.sameDepthMergeCids[0] !== cid;
  const ctrlChanged = state.ctrlLaneCids.length !== 0;
  if (!highlightChanged && !mergeChanged && !ctrlChanged) return;
  state = {
    ...state,
    highlightCid: cid,
    sameDepthMergeCids: nextMerge,
    ctrlLaneCids: ctrlChanged ? (IDLE.ctrlLaneCids as readonly string[]) : state.ctrlLaneCids,
  };
  notify();
}

/**
 * Per-cid selectors — each `Identified` only re-renders when ITS boolean flips.
 * `useSyncExternalStore` uses `Object.is`, so primitive returns are fine.
 */
export function useIsHighlighted(cid: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.highlightCid === cid,
    () => false,
  );
}

export function useIsInAltMerge(cid: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.sameDepthMergeCids.includes(cid),
    () => false,
  );
}

export function useIsInCtrlLane(cid: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.ctrlLaneCids.includes(cid),
    () => false,
  );
}

export function useIsFlashing(cid: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.flashCid === cid,
    () => false,
  );
}
