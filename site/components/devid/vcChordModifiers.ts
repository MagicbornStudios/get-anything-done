/**
 * Visual Context panel modifier chords — single source of truth for keyboard state
 * shape and how it maps to screenshot / handoff button affordances.
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

/** PNG strip: Ctrl+Shift → Dir, Ctrl → Pick, Alt → Upd, else PNG. */
export type VcScreenshotChordMode = "png" | "dir" | "media" | "upd";

export function resolveVcScreenshotChordMode(m: VcChordModifiers): VcScreenshotChordMode {
  if (m.ctrl && m.shift) return "dir";
  if (m.ctrl) return "media";
  if (m.alt) return "upd";
  return "png";
}

/** Update row: Mic + image “Upd” when Alt without Ctrl. */
export function vcChordShowsUpdateMediaPair(m: VcChordModifiers): boolean {
  return m.alt && !m.ctrl;
}

/** Delete row: Trash + media hint when Ctrl without Alt/Shift (storage-delete copy). */
export function vcChordShowsDeleteMediaPair(m: VcChordModifiers): boolean {
  return m.ctrl && !m.alt && !m.shift;
}

/**
 * Subscribes to global modifier sync for VC chrome. Call from DevIdProvider only (one subscription per app).
 */
export function attachVcChordGlobalListeners(
  setMod: (next: VcChordModifiers) => void,
): () => void {
  const prevRef = { alt: false, ctrl: false, shift: false };
  const publish = (e: Event) => {
    const next = readChordFromEvent(e as MouseEvent);
    const p = prevRef;
    if (next.alt === p.alt && next.ctrl === p.ctrl && next.shift === p.shift) return;
    p.alt = next.alt;
    p.ctrl = next.ctrl;
    p.shift = next.shift;
    setMod(next);
  };
  const clear = () => {
    prevRef.alt = false;
    prevRef.ctrl = false;
    prevRef.shift = false;
    setMod(VC_CHORD_IDLE);
  };
  window.addEventListener("keydown", publish, true);
  window.addEventListener("keyup", publish, true);
  window.addEventListener("pointermove", publish, true);
  window.addEventListener("blur", clear);
  const onVis = () => {
    if (document.visibilityState === "hidden") clear();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    window.removeEventListener("keydown", publish, true);
    window.removeEventListener("keyup", publish, true);
    window.removeEventListener("pointermove", publish, true);
    window.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", onVis);
  };
}
