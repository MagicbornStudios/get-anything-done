/**
 * Visual Context modifier chord — core state primitives.
 *
 * This file is **framework-agnostic**: plain TypeScript, no React, no DOM
 * assumptions beyond `KeyboardEvent` + `window`/`document` for the global
 * listener helper. It owns:
 *
 * - The `VcChordModifiers` shape (what the store publishes).
 * - How to read that shape from a keyboard/mouse event.
 * - The global listener wiring that drives the store.
 *
 * What it **does not** own:
 *
 * - "What does Alt+Ctrl mean for the delete button?" — that lives in
 *   `./lane-rules.ts` as pure UX policy.
 * - React subscriptions / context — those live in `./store.ts` and
 *   `./panel-context.tsx`.
 *
 * Splitting along this seam matches the Bundle C target layering: this file
 * ports to `@gad/vc-core` verbatim, lane rules port too, and the React glue
 * stays in an adapter package.
 */

export type VcChordModifiers = {
  alt: boolean;
  /** Control or Meta (Cmd) */
  ctrl: boolean;
  shift: boolean;
};

export const VC_CHORD_IDLE: VcChordModifiers = { alt: false, ctrl: false, shift: false };

/** Works for native `Event` and React `MouseEvent` (both expose `getModifierState`). */
export function readChordFromEvent(e: { getModifierState(key: string): boolean }): VcChordModifiers {
  return {
    alt: e.getModifierState("Alt"),
    ctrl: e.getModifierState("Control") || e.getModifierState("Meta"),
    shift: e.getModifierState("Shift"),
  };
}

/**
 * Only modifier keydown/keyup events can transition the chord. Filtering on
 * `e.key` lets us short-circuit plain typing (letters, digits, arrows) in the
 * capture phase with a single Set lookup — no allocation, no
 * `getModifierState` calls, no diff. The `blur` / `visibilitychange` handlers
 * still reset stale state when focus leaves the window, so we can't miss an
 * "Alt stuck down" case.
 */
const VC_CHORD_MODIFIER_KEYS: ReadonlySet<string> = new Set([
  "Alt",
  "AltGraph",
  "Control",
  "Meta",
  "Shift",
]);

/**
 * Subscribes to global modifier sync for VC chrome. Call via `vcChordStore`
 * (one listener per app).
 *
 * Tracks Alt / Ctrl|Meta / Shift via `keydown`/`keyup` only. A previous
 * version also listened to `pointermove` as a stale-sync fallback, but that
 * fired 60–1000 Hz and paid allocation + diff cost on every mouse pixel.
 * `keydown`/`keyup` capture every transition while the window has focus;
 * `blur` and `visibilitychange` reset stale state when focus leaves. No
 * perceptible loss in accuracy, but the hot path on keypress/mousemove
 * shrinks dramatically.
 */
export function attachVcChordGlobalListeners(
  setMod: (next: VcChordModifiers) => void,
): () => void {
  const prevRef = { alt: false, ctrl: false, shift: false };
  const publish = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (!VC_CHORD_MODIFIER_KEYS.has(ke.key)) return;
    const next = readChordFromEvent(ke);
    const p = prevRef;
    if (next.alt === p.alt && next.ctrl === p.ctrl && next.shift === p.shift) return;
    p.alt = next.alt;
    p.ctrl = next.ctrl;
    p.shift = next.shift;
    setMod(next);
  };
  const clear = () => {
    if (!prevRef.alt && !prevRef.ctrl && !prevRef.shift) return;
    prevRef.alt = false;
    prevRef.ctrl = false;
    prevRef.shift = false;
    setMod(VC_CHORD_IDLE);
  };
  window.addEventListener("keydown", publish, true);
  window.addEventListener("keyup", publish, true);
  window.addEventListener("blur", clear);
  const onVis = () => {
    if (document.visibilityState === "hidden") clear();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.removeEventListener("keydown", publish, true);
    window.removeEventListener("keyup", publish, true);
    window.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", onVis);
  };
}
