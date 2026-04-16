"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { DevIdSearchDialog } from "./DevIdSearchDialog";
import type { PromptVerbosity } from "./DevIdPromptTemplates";
import {
  clearPersistedVcExportDirectory,
  restoreVcExportDirectoryHandle,
} from "./vc-export-persist";
import {
  VC_CHORD_IDLE,
  attachVcChordGlobalListeners,
  type VcChordModifiers,
} from "./vcChordModifiers";

export type { VcChordModifiers };

interface DevIdContextValue {
  enabled: boolean;
  toggle: () => void;
  highlightCid: string | null;
  setHighlightCid: (cid: string | null) => void;
  /** Alt-lane: same-depth merge / primary handoff group (panel: Alt+click rows; page: Alt+click landmarks). */
  sameDepthMergeCids: string[];
  setSameDepthMergeCids: Dispatch<SetStateAction<string[]>>;
  /** Ctrl/Cmd-lane: cross-depth reference targets (panel: Ctrl/Cmd+click rows; page: Ctrl/Cmd+click landmarks). */
  ctrlLaneCids: string[];
  setCtrlLaneCids: Dispatch<SetStateAction<string[]>>;
  flashCid: string | null;
  flashComponent: (cid: string) => void;
  promptVerbosity: PromptVerbosity;
  setPromptVerbosity: Dispatch<SetStateAction<PromptVerbosity>>;
  /** Radix hovercards / docked tooltips on VC panel chrome; persisted like prompt verbosity. */
  vcPanelHoverHintsEnabled: boolean;
  setVcPanelHoverHintsEnabled: Dispatch<SetStateAction<boolean>>;
  /** VC export folder (PNG / Alt media pick); restored from IndexedDB when permitted. */
  vcExportDirHandleRef: MutableRefObject<FileSystemDirectoryHandle | null>;
  /** Clears saved export folder, in-memory handle, and VC media path lists (Ctrl/Cmd+click Delete on panel). */
  clearPersistedVcExportFolder: () => Promise<void>;
  /** Display paths (e.g. `folder/file.png`) appended to update handoff when using Alt+Pick. */
  updatePromptMediaRefs: string[];
  setUpdatePromptMediaRefs: Dispatch<SetStateAction<string[]>>;
  /** Display paths appended to delete handoff when using Ctrl/Cmd+Pick. */
  deletePromptMediaRefs: string[];
  setDeletePromptMediaRefs: Dispatch<SetStateAction<string[]>>;
  /** Alt / Ctrl|Meta / Shift for VC panel chord preview (single listener, shared by buttons). */
  vcChordModifiers: VcChordModifiers;
  /**
   * While true, `Identified` omits Alt/Ctrl/flash ring styling so PNG capture matches ship chrome.
   * Set only around `captureElementToPngBlob` (not persisted).
   */
  vcIdentifiedRingsSuppressedForPngCapture: boolean;
  setVcIdentifiedRingsSuppressedForPngCapture: Dispatch<SetStateAction<boolean>>;
  /** Octant-drag spatial hints: live insert when handoff dialog is open, else queued for next open / dictation copy. */
  submitVcHandoffUpdateSnippet: (snippet: string) => void;
  registerVcHandoffSnippetInserter: (fn: ((snippet: string) => void) | null) => void;
  consumeVcHandoffQueuedSnippets: () => string[];
  /** Band-level context panels dismissed by the user (localStorage-backed). */
  dismissedBandCids: Set<string>;
  /** Toggle dismiss state for a single band cid. */
  toggleBandDismiss: (cid: string) => void;
  /** Clear all dismissed bands, restoring all panels. */
  resetDismissedBands: () => void;
}

const noopRef = { current: null } as MutableRefObject<FileSystemDirectoryHandle | null>;

const DevIdContext = createContext<DevIdContextValue>({
  enabled: false,
  toggle: () => {},
  highlightCid: null,
  setHighlightCid: () => {},
  sameDepthMergeCids: [],
  setSameDepthMergeCids: () => {},
  ctrlLaneCids: [],
  setCtrlLaneCids: () => {},
  flashCid: null,
  flashComponent: () => {},
  promptVerbosity: "compact",
  setPromptVerbosity: () => {},
  vcPanelHoverHintsEnabled: false,
  setVcPanelHoverHintsEnabled: () => {},
  vcExportDirHandleRef: noopRef,
  clearPersistedVcExportFolder: async () => {},
  updatePromptMediaRefs: [],
  setUpdatePromptMediaRefs: () => {},
  deletePromptMediaRefs: [],
  setDeletePromptMediaRefs: () => {},
  vcChordModifiers: VC_CHORD_IDLE,
  vcIdentifiedRingsSuppressedForPngCapture: false,
  setVcIdentifiedRingsSuppressedForPngCapture: () => {},
  submitVcHandoffUpdateSnippet: () => {},
  registerVcHandoffSnippetInserter: () => {},
  consumeVcHandoffQueuedSnippets: () => [],
  dismissedBandCids: new Set<string>(),
  toggleBandDismiss: () => {},
  resetDismissedBands: () => {},
});

export function DevIdProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [enabled, setEnabled] = useState(false);
  const [highlightCid, setHighlightCid] = useState<string | null>(null);
  const [sameDepthMergeCids, setSameDepthMergeCids] = useState<string[]>([]);
  const [ctrlLaneCids, setCtrlLaneCids] = useState<string[]>([]);
  const [flashCid, setFlashCid] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [promptVerbosity, setPromptVerbosity] = useState<PromptVerbosity>("compact");
  const [vcPanelHoverHintsEnabled, setVcPanelHoverHintsEnabled] = useState(false);
  const [updatePromptMediaRefs, setUpdatePromptMediaRefs] = useState<string[]>([]);
  const [deletePromptMediaRefs, setDeletePromptMediaRefs] = useState<string[]>([]);
  const vcExportDirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [vcChordModifiers, setVcChordModifiers] = useState<VcChordModifiers>(VC_CHORD_IDLE);
  const [vcIdentifiedRingsSuppressedForPngCapture, setVcIdentifiedRingsSuppressedForPngCapture] =
    useState(false);

  const vcHandoffSnippetInserterRef = useRef<((snippet: string) => void) | null>(null);
  const vcHandoffSnippetQueueRef = useRef<string[]>([]);

  const LS_DISMISSED_KEY = "vcs-dismissed-panels";
  const [dismissedBandCids, setDismissedBandCids] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem(LS_DISMISSED_KEY);
      if (!raw) return new Set<string>();
      const arr: unknown = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set<string>(arr.filter((v): v is string => typeof v === "string"));
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  const persistDismissed = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(LS_DISMISSED_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // ignore storage issues
    }
  }, []);

  const toggleBandDismiss = useCallback((cid: string) => {
    setDismissedBandCids((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      persistDismissed(next);
      return next;
    });
  }, [persistDismissed]);

  const resetDismissedBands = useCallback(() => {
    setDismissedBandCids(new Set<string>());
    persistDismissed(new Set<string>());
    toast.success("All dismissed context panels restored.");
  }, [persistDismissed]);

  const submitVcHandoffUpdateSnippet = useCallback((snippet: string) => {
    const t = snippet.trim();
    if (!t) return;
    const ins = vcHandoffSnippetInserterRef.current;
    if (ins) {
      try {
        ins(t);
        return;
      } catch {
        /* fall through to queue */
      }
    }
    vcHandoffSnippetQueueRef.current.push(t);
  }, []);

  const registerVcHandoffSnippetInserter = useCallback((fn: ((snippet: string) => void) | null) => {
    vcHandoffSnippetInserterRef.current = fn;
  }, []);

  const consumeVcHandoffQueuedSnippets = useCallback((): string[] => {
    const q = vcHandoffSnippetQueueRef.current;
    vcHandoffSnippetQueueRef.current = [];
    return q.slice();
  }, []);

  const clearPersistedVcExportFolder = useCallback(async () => {
    vcExportDirHandleRef.current = null;
    setUpdatePromptMediaRefs([]);
    setDeletePromptMediaRefs([]);
    await clearPersistedVcExportDirectory();
    toast.success(
      "VC export folder cleared. Choose a new folder on the next PNG / Pick / Dir — or use Ctrl+Shift+Delete on the panel.",
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const h = await restoreVcExportDirectoryHandle();
        if (cancelled || !h) return;
        const perm = await h.queryPermission({ mode: "readwrite" });
        if (perm === "granted") {
          vcExportDirHandleRef.current = h;
        }
      } catch {
        // ignore restore errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => attachVcChordGlobalListeners(setVcChordModifiers), []);

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
    const hoverHints = typeof window !== "undefined" ? localStorage.getItem("devid.panel.hoverHints") : null;
    if (hoverHints === "1") setVcPanelHoverHintsEnabled(true);
    else if (hoverHints === "0") setVcPanelHoverHintsEnabled(false);
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
      localStorage.setItem("devid.panel.hoverHints", vcPanelHoverHintsEnabled ? "1" : "0");
    } catch {
      // ignore storage issues
    }
  }, [vcPanelHoverHintsEnabled]);

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
      const target = e.target;
      const inEditable =
        target instanceof HTMLElement &&
        Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
      if (inEditable && e.key !== "Escape") return;
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
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setSameDepthMergeCids(highlightCid ? [highlightCid] : []);
        return;
      }
      if (!e.altKey && (e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setCtrlLaneCids([]);
        return;
      }
      if (e.key === "Escape") {
        setHighlightCid(null);
        setSameDepthMergeCids([]);
        setCtrlLaneCids([]);
        setUpdatePromptMediaRefs([]);
        setDeletePromptMediaRefs([]);
        vcHandoffSnippetQueueRef.current = [];
        setFlashCid(null);
        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, highlightCid]);

  const contextValue = useMemo<DevIdContextValue>(
    () => ({
      enabled,
      toggle,
      highlightCid,
      setHighlightCid,
      sameDepthMergeCids,
      setSameDepthMergeCids,
      ctrlLaneCids,
      setCtrlLaneCids,
      flashCid,
      flashComponent,
      promptVerbosity,
      setPromptVerbosity,
      vcPanelHoverHintsEnabled,
      setVcPanelHoverHintsEnabled,
      vcExportDirHandleRef,
      clearPersistedVcExportFolder,
      updatePromptMediaRefs,
      setUpdatePromptMediaRefs,
      deletePromptMediaRefs,
      setDeletePromptMediaRefs,
      vcChordModifiers,
      vcIdentifiedRingsSuppressedForPngCapture,
      setVcIdentifiedRingsSuppressedForPngCapture,
      submitVcHandoffUpdateSnippet,
      registerVcHandoffSnippetInserter,
      consumeVcHandoffQueuedSnippets,
      dismissedBandCids,
      toggleBandDismiss,
      resetDismissedBands,
    }),
    [
      enabled,
      toggle,
      highlightCid,
      sameDepthMergeCids,
      ctrlLaneCids,
      flashCid,
      flashComponent,
      promptVerbosity,
      vcPanelHoverHintsEnabled,
      clearPersistedVcExportFolder,
      updatePromptMediaRefs,
      deletePromptMediaRefs,
      vcChordModifiers,
      vcIdentifiedRingsSuppressedForPngCapture,
      submitVcHandoffUpdateSnippet,
      registerVcHandoffSnippetInserter,
      consumeVcHandoffQueuedSnippets,
      dismissedBandCids,
      toggleBandDismiss,
      resetDismissedBands,
    ],
  );

  return (
    <DevIdContext.Provider value={contextValue}>
      {children}
      {enabled ? (
        <>
          <DevIdStatusBadge
            onOpenSearch={() => setSearchOpen(true)}
            dismissedCount={dismissedBandCids.size}
            onResetDismissed={resetDismissedBands}
          />
          <DevIdSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        </>
      ) : null}
    </DevIdContext.Provider>
  );
}

function DevIdStatusBadge({
  onOpenSearch,
  dismissedCount,
  onResetDismissed,
}: {
  onOpenSearch: () => void;
  dismissedCount: number;
  onResetDismissed: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2 rounded-full border border-accent/60 bg-background/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent shadow-lg backdrop-blur">
      <span aria-hidden>
        DevIds ON · Alt+I toggle · Esc clear · Alt+click / Alt+row: depth merge · Ctrl/Cmd+click / Ctrl+row: cross-depth lane · Alt+D / Ctrl+D clear lane
      </span>
      <button
        type="button"
        onClick={onOpenSearch}
        className="rounded border border-border/60 bg-card/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground hover:bg-card"
      >
        Search (Alt+K)
      </button>
      {dismissedCount > 0 ? (
        <button
          type="button"
          onClick={onResetDismissed}
          className="rounded border border-border/60 bg-card/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground hover:bg-card"
        >
          Reset {dismissedCount} dismissed
        </button>
      ) : null}
    </div>
  );
}

export function useDevId() {
  return useContext(DevIdContext);
}
