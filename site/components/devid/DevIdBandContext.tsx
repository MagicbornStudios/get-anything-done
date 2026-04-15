"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Set by `SiteSection` for all descendants (including Radix portaled dialogs, which
 * keep React context). `DialogContent` reads this to set `data-devid-band` so the band
 * DevPanel can merge modal `data-cid` landmarks into the section scan.
 */
const DevIdBandContext = createContext<string | undefined>(undefined);

export function DevIdBandProvider({
  bandCid,
  children,
}: {
  bandCid: string | undefined;
  children: ReactNode;
}) {
  return <DevIdBandContext.Provider value={bandCid}>{children}</DevIdBandContext.Provider>;
}

export function useDevIdBandCid(): string | undefined {
  return useContext(DevIdBandContext);
}
