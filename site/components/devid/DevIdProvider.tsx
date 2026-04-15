"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import { DevIdSearchDialog } from "./DevIdSearchDialog";
import type { PromptVerbosity } from "./DevIdPromptTemplates";

interface DevIdContextValue {
  enabled: boolean;
  toggle: () => void;
  highlightCid: string | null;
  setHighlightCid: (cid: string | null) => void;
  flashCid: string | null;
  flashComponent: (cid: string) => void;
  promptVerbosity: PromptVerbosity;
  setPromptVerbosity: Dispatch<SetStateAction<PromptVerbosity>>;
}

const DevIdContext = createContext<DevIdContextValue>({
  enabled: false,
  toggle: () => {},
  highlightCid: null,
  setHighlightCid: () => {},
  flashCid: null,
  flashComponent: () => {},
  promptVerbosity: "full",
  setPromptVerbosity: () => {},
});

export function DevIdProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [enabled, setEnabled] = useState(false);
  const [highlightCid, setHighlightCid] = useState<string | null>(null);
  const [flashCid, setFlashCid] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [promptVerbosity, setPromptVerbosity] = useState<PromptVerbosity>("full");
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashComponent = useCallback((cid: string) => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashCid(cid);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashCid((cur) => (cur === cid ? null : cur));
      flashTimeoutRef.current = null;
    }, 1100);
  }, []);

  useEffect(
    () => () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    const envOn = process.env.NEXT_PUBLIC_DEV_IDS === "1";
    const stored = typeof window !== "undefined" ? localStorage.getItem("devIds") : null;
    if (stored === "1" || (stored == null && envOn)) setEnabled(true);
    const verbosity = typeof window !== "undefined" ? localStorage.getItem("devid.prompt.verbosity") : null;
    if (verbosity === "compact" || verbosity === "full") setPromptVerbosity(verbosity);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("devid.prompt.verbosity", promptVerbosity);
    } catch {
      // ignore storage issues
    }
  }, [promptVerbosity]);

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("devid.pending.highlight");
      if (!pending) return;
      sessionStorage.removeItem("devid.pending.highlight");
      setEnabled(true);
      setHighlightCid(pending);
      flashComponent(pending);
    } catch {
      // ignore storage issues
    }
  }, [pathname, flashComponent]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("devIds", next ? "1" : "0");
      } catch {
        // ignore storage issues
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setHighlightCid(null);
        setFlashCid(null);
        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <DevIdContext.Provider
      value={{
        enabled,
        toggle,
        highlightCid,
        setHighlightCid,
        flashCid,
        flashComponent,
        promptVerbosity,
        setPromptVerbosity,
      }}
    >
      {children}
      {enabled ? (
        <>
          <DevIdStatusBadge onOpenSearch={() => setSearchOpen(true)} />
          <DevIdSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        </>
      ) : null}
    </DevIdContext.Provider>
  );
}

function DevIdStatusBadge({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-full border border-accent/60 bg-background/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent shadow-lg backdrop-blur">
      <span aria-hidden>DevIds ON · Alt+I toggle · Esc clear · Alt+click landmark toggles</span>
      <button
        type="button"
        onClick={onOpenSearch}
        className="rounded border border-border/60 bg-card/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground hover:bg-card"
      >
        Search (Alt+K)
      </button>
    </div>
  );
}

export function useDevId() {
  return useContext(DevIdContext);
}
