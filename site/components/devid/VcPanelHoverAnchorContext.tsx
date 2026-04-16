"use client";

import { createContext, useContext, type RefObject } from "react";

/** Popper reference for docked `DevChromeHoverHint` — the Visual Context Panel shell, not each trigger. */
export const VcPanelHoverAnchorContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useVcPanelHoverAnchorRef() {
  return useContext(VcPanelHoverAnchorContext);
}
