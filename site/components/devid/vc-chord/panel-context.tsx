"use client";

/**
 * Panel-scoped chord consolidation — one `useVcChord()` subscription per mounted
 * `DevPanel`, shared with every chord-reactive descendant via context.
 *
 * Why this exists
 * ---------------
 * A DevPanel subtree has ~5 chord-reactive leaves: the depth pager (Ctrl→X), the
 * handoff row (Upd/Del icon swap), the screenshot button (PNG/Pick/Dir mode hint),
 * the hover prompt actions (outer Upd/Del lanes), and the position controls
 * (arrow→X dismiss). Each previously called `useVcChord()` independently, so a
 * single Ctrl keypress fanned out to `5 × N` `useSyncExternalStore` callbacks
 * with `N` panels mounted. React commits each subscriber separately, which is
 * exactly what you see as the staggered X-icon cascade.
 *
 * Here a single `PanelChordProvider` at the DevPanel root subscribes once,
 * memoizes the chord **plus its precomputed display flags**, and publishes
 * through React context. Descendants read via `usePanelChord()` — plain
 * `useContext`, no external-store subscription. Cascade collapses from `5N → N`.
 *
 * Scope contract
 * --------------
 * `usePanelChord()` MUST be called inside a `PanelChordProvider`. If you need
 * chord state outside a DevPanel (e.g. a global toolbar), subscribe directly
 * via `useVcChord()` from `./vcChordStore`. Radix Dialog portals preserve
 * React context, so provider at a DevPanel's render root also covers its
 * portaled handoff dialog.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { VcChordModifiers } from "./modifiers";
import {
  vcChordIsOuterDeleteHeld,
  vcChordIsOuterUpdateHeld,
  vcChordShowsDeleteMediaPair,
  vcChordShowsUpdateMediaPair,
} from "./lane-rules";
import { useVcChord } from "./store";

export interface PanelChordValue {
  /** Raw chord object — same shape as `useVcChord()`. */
  chord: VcChordModifiers;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Alt held without Ctrl: update lane paints Mic+Images + "Upd" label. */
  updMediaShow: boolean;
  /** Ctrl held without Alt/Shift: delete lane paints Trash+Images (storage-delete). */
  delMediaShow: boolean;
  /** Ctrl held alone: Upd button switches prompt to the outer/surrounding variant. */
  outerUpdateHeld: boolean;
  /** Alt held alone: Del button switches prompt to delete unidentified surrounding sections. */
  outerDeleteHeld: boolean;
}

const PanelChordContext = createContext<PanelChordValue | null>(null);

/**
 * Subscribes to `useVcChord()` once and memoizes the derived display flags.
 * Render this at the root of each `DevPanel` output (both branches); all
 * chord-reactive descendants then consume via `usePanelChord()` without
 * subscribing again.
 */
export function PanelChordProvider({ children }: { children: ReactNode }) {
  const chord = useVcChord();
  const value = useMemo<PanelChordValue>(
    () => ({
      chord,
      ctrl: chord.ctrl,
      alt: chord.alt,
      shift: chord.shift,
      updMediaShow: vcChordShowsUpdateMediaPair(chord),
      delMediaShow: vcChordShowsDeleteMediaPair(chord),
      outerUpdateHeld: vcChordIsOuterUpdateHeld(chord),
      outerDeleteHeld: vcChordIsOuterDeleteHeld(chord),
    }),
    [chord],
  );
  return <PanelChordContext.Provider value={value}>{children}</PanelChordContext.Provider>;
}

/**
 * Returns the nearest `PanelChordProvider`'s value. In dev, logs a one-time
 * warning if called outside a provider (indicates a stray caller that will
 * silently re-subscribe to the global store via the fallback path below).
 *
 * The fallback exists so single-instance hosts (e.g. a standalone chord debug
 * probe) can still mount; production callers should always live inside a panel.
 */
export function usePanelChord(): PanelChordValue {
  const ctx = useContext(PanelChordContext);
  if (ctx !== null) return ctx;
  if (process.env.NODE_ENV !== "production") {
    warnMissingProviderOnce();
  }
  return fallbackPanelChordValue(VC_CHORD_IDLE_VALUE);
}

const VC_CHORD_IDLE_VALUE: VcChordModifiers = { alt: false, ctrl: false, shift: false };

function fallbackPanelChordValue(chord: VcChordModifiers): PanelChordValue {
  return {
    chord,
    ctrl: chord.ctrl,
    alt: chord.alt,
    shift: chord.shift,
    updMediaShow: vcChordShowsUpdateMediaPair(chord),
    delMediaShow: vcChordShowsDeleteMediaPair(chord),
    outerUpdateHeld: vcChordIsOuterUpdateHeld(chord),
    outerDeleteHeld: vcChordIsOuterDeleteHeld(chord),
  };
}

let warnedMissingProvider = false;
function warnMissingProviderOnce() {
  if (warnedMissingProvider) return;
  warnedMissingProvider = true;
  // eslint-disable-next-line no-console
  console.warn(
    "[devid] usePanelChord() called outside <PanelChordProvider>. Returning idle chord; wrap in PanelChordProvider or subscribe via useVcChord() directly.",
  );
}
