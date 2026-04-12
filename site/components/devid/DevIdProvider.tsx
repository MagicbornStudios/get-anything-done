"use client";

/**
 * DevIdProvider — enables component ID overlay mode across the site.
 *
 * Usage:
 *   <DevIdProvider>
 *     <App />
 *   </DevIdProvider>
 *
 * Activation:
 *   - Env flag: NEXT_PUBLIC_DEV_IDS=1 (enabled-by-default in dev builds)
 *   - Keyboard: Alt+I toggles globally at runtime
 *   - Escape: closes any open section panels
 *
 * Prod builds with NEXT_PUBLIC_DEV_IDS unset: the provider is still mounted
 * but `enabled` stays false; the keyboard listener is still active so you can
 * flip it on in a deployed env via devtools if you need to. Zero visual impact
 * until toggled on.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface DevIdContextValue {
  enabled: boolean;
  toggle: () => void;
  highlightCid: string | null;
  setHighlightCid: (cid: string | null) => void;
}

const DevIdContext = createContext<DevIdContextValue>({
  enabled: false,
  toggle: () => {},
  highlightCid: null,
  setHighlightCid: () => {},
});

export function DevIdProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [highlightCid, setHighlightCid] = useState<string | null>(null);

  // Hydrate from env + localStorage on mount
  useEffect(() => {
    const envOn = process.env.NEXT_PUBLIC_DEV_IDS === "1";
    const stored = typeof window !== "undefined" ? localStorage.getItem("devIds") : null;
    if (stored === "1" || (stored == null && envOn)) {
      setEnabled(true);
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("devIds", next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  // Keyboard: Alt+I toggles, Escape clears highlight
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setHighlightCid(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <DevIdContext.Provider value={{ enabled, toggle, highlightCid, setHighlightCid }}>
      {children}
      {enabled && <DevIdStatusBadge />}
    </DevIdContext.Provider>
  );
}

function DevIdStatusBadge() {
  return (
    <div
      className="fixed bottom-4 left-4 z-[9999] rounded-full border border-accent/60 bg-background/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent shadow-lg backdrop-blur"
      aria-hidden
    >
      DevIds ON · Alt+I to toggle
    </div>
  );
}

export function useDevId() {
  return useContext(DevIdContext);
}
