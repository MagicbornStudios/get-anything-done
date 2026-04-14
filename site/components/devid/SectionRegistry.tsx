"use client";

/**
 * Per-SiteSection registry of `<Identified>` components. Each SiteSection that
 * opts into dev-ids creates one of these, and child `<Identified>` wrappers
 * push themselves into it via `useIdentifiedRegistration`.
 *
 * The registry is intentionally section-scoped: walking the whole DOM would
 * be noisy. You ask "what's in THIS section" and get a flat list of cids
 * paired with component types.
 */

import { createContext, useContext, useRef, useState, useCallback, useMemo } from "react";

export type DevIdComponentTag = "SiteSection" | "Identified" | "PageIdentified";

export interface RegistryEntry {
  cid: string;
  label: string;
  depth: number;
  componentTag?: DevIdComponentTag;
  searchHint?: string;
}

interface SectionRegistryValue {
  register: (entry: RegistryEntry) => () => void;
  entries: RegistryEntry[];
  maxDepth: number;
}

const SectionRegistryContext = createContext<SectionRegistryValue | null>(null);

export function SectionRegistryProvider({
  children,
  maxDepth = 3,
}: {
  children: React.ReactNode;
  maxDepth?: number;
}) {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const counterRef = useRef(0);

  const register = useCallback(
    (entry: RegistryEntry) => {
      setEntries((prev) => {
        if (prev.some((e) => e.cid === entry.cid)) return prev;
        return [...prev, entry];
      });
      return () => {
        setEntries((prev) => prev.filter((e) => e.cid !== entry.cid));
      };
    },
    [],
  );

  // Suppress lint: ref used only to allocate deterministic ids if needed later.
  void counterRef;

  const value = useMemo(
    () => ({ register, entries, maxDepth }),
    [register, entries, maxDepth],
  );

  return (
    <SectionRegistryContext.Provider value={value}>
      {children}
    </SectionRegistryContext.Provider>
  );
}

export function useSectionRegistry() {
  return useContext(SectionRegistryContext);
}
