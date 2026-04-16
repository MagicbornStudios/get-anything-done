"use client";

import { useEffect, useState, type RefObject } from "react";

function readModifiers(e: Event): { alt: boolean; ctrl: boolean } {
  const m = e as MouseEvent;
  return {
    alt: m.getModifierState("Alt"),
    ctrl: m.getModifierState("Control") || m.getModifierState("Meta"),
  };
}

/**
 * Live Alt / Ctrl|Meta chord preview for VC chrome while the pointer is over the
 * trigger element or a docked hint tooltip that shares `chromeHintScopeId`.
 * Fixes lost updates when the tooltip is portaled outside the trigger subtree.
 */
export function useVcChordPreview(
  triggerRef: RefObject<HTMLElement | null>,
  chromeHintScopeId: string | null,
): { alt: boolean; ctrl: boolean } {
  const [mod, setMod] = useState({ alt: false, ctrl: false });

  useEffect(() => {
    if (!chromeHintScopeId) return;

    const contentSelector = `[data-vc-chrome-hint-content="${chromeHintScopeId.replace(/"/g, "")}"]`;

    const pointerInHintZone = (t: EventTarget | null): boolean => {
      if (!(t instanceof Node)) return false;
      if (triggerRef.current?.contains(t)) return true;
      if (t instanceof Element && t.closest(contentSelector)) return true;
      return false;
    };

    const sync = (e: Event) => {
      if (!pointerInHintZone(e.target)) {
        setMod({ alt: false, ctrl: false });
        return;
      }
      setMod(readModifiers(e));
    };

    const clear = () => setMod({ alt: false, ctrl: false });

    window.addEventListener("keydown", sync, true);
    window.addEventListener("keyup", sync, true);
    window.addEventListener("pointermove", sync, true);
    window.addEventListener("blur", clear);
    const onVis = () => {
      if (document.visibilityState === "hidden") clear();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("keydown", sync, true);
      window.removeEventListener("keyup", sync, true);
      window.removeEventListener("pointermove", sync, true);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [chromeHintScopeId, triggerRef]);

  return mod;
}
