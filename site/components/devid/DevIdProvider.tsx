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
import type { VcChordModifiers } from "./vc-chord";
import { matchShortcut } from "./devid-shortcut-registry";
import {
  clearAllSelection,
  peekSelection,
  setCtrlLaneCids as setCtrlLaneCidsStore,
  setFlashCid as setFlashCidStore,
  setHighlightCid as setHighlightCidStore,
  setSameDepthMergeCids as setSameDepthMergeCidsStore,
  useSelectionSnapshot,
} from "./vc-selection";

export type { VcChordModifiers };

/**
 * Context is split into three slices so hot consumers (the hundreds of `Identified`
 * instances) only re-render on the state they actually care about. `useDevId()` stays
 * as a legacy merged hook that composes all three — existing callers keep working.
 *
 * - `DevIdEnabledContext`: `{ enabled, toggle }` — rarely flips.
 * - `DevIdSelectionContext`: highlight / lane state — changes on Alt/Ctrl+click and Escape.
 * - `DevIdSettingsContext`: verbosity, hover hints, export folder, media refs,
 *   PNG-capture ring suppression, VC handoff snippet API, dismissed bands.
 *
 * Why three contexts instead of one context + selector: React's built-in context
 * notifies every consumer on any value change, regardless of which field changed.
 * Slicing gives per-field change isolation without pulling in `use-context-selector`.
 */

interface DevIdEnabledContextValue {
  enabled: boolean;
  toggle: () => void;
}

interface DevIdSelectionContextValue {
  highlightCid: string | null;
  setHighlightCid: (cid: string | null) => void;
  /** Alt-lane: same-depth merge / primary handoff group (panel: Alt+click rows; page: Alt+click landmarks). */
  sameDepthMergeCids: readonly string[];
  setSameDepthMergeCids: Dispatch<SetStateAction<string[]>>;
  /** Ctrl/Cmd-lane: cross-depth reference targets (panel: Ctrl/Cmd+click rows; page: Ctrl/Cmd+click landmarks). */
  ctrlLaneCids: readonly string[];
  setCtrlLaneCids: Dispatch<SetStateAction<string[]>>;
  flashCid: string | null;
  flashComponent: (cid: string) => void;
}

interface DevIdSettingsContextValue {
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

/** Legacy merged value preserved for existing `useDevId()` callers. */
export type DevIdContextValue = DevIdEnabledContextValue &
  DevIdSelectionContextValue &
  DevIdSettingsContextValue;

const noopRef = { current: null } as MutableRefObject<FileSystemDirectoryHandle | null>;

const DevIdEnabledContext = createContext<DevIdEnabledContextValue>({
  enabled: false,
  toggle: () => {},
});

const DevIdSelectionContext = createContext<DevIdSelectionContextValue>({
  highlightCid: null,
  setHighlightCid: () => {},
  sameDepthMergeCids: [],
  setSameDepthMergeCids: () => {},
  ctrlLaneCids: [],
  setCtrlLaneCids: () => {},
  flashCid: null,
  flashComponent: () => {},
});

const DevIdSettingsContext = createContext<DevIdSettingsContextValue>({
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
  /**
   * Selection is owned by the `vc-selection` external store so each `Identified`
   * can subscribe only to its own cid via `useIsHighlighted(cid)` etc.
   * `useSelectionSnapshot()` re-renders the provider whenever any slice changes
   * (rare — only on click / Escape / flash), and we feed the slices into the
   * legacy selection context so panels keep working.
   */
  const selectionSnapshot = useSelectionSnapshot();
  const { highlightCid, sameDepthMergeCids, ctrlLaneCids, flashCid } = selectionSnapshot;

  // Stable setter references that write through to the store.
  const setHighlightCid = useCallback((cid: string | null) => {
    setHighlightCidStore(cid);
  }, []);
  const setSameDepthMergeCids = useCallback<Dispatch<SetStateAction<string[]>>>(
    (next) => {
      if (typeof next === "function") {
        const updater = next as (prev: string[]) => string[];
        setSameDepthMergeCidsStore((prev) => updater([...prev]));
      } else {
        setSameDepthMergeCidsStore(next);
      }
    },
    [],
  );
  const setCtrlLaneCids = useCallback<Dispatch<SetStateAction<string[]>>>((next) => {
    if (typeof next === "function") {
      const updater = next as (prev: string[]) => string[];
      setCtrlLaneCidsStore((prev) => updater([...prev]));
    } else {
      setCtrlLaneCidsStore(next);
    }
  }, []);
  const setFlashCid = useCallback((cid: string | null) => {
    setFlashCidStore(cid);
  }, []);

  const [searchOpen, setSearchOpen] = useState(false);
  const [promptVerbosity, setPromptVerbosity] = useState<PromptVerbosity>("compact");
  const [vcPanelHoverHintsEnabled, setVcPanelHoverHintsEnabled] = useState(false);
  const [updatePromptMediaRefs, setUpdatePromptMediaRefs] = useState<string[]>([]);
  const [deletePromptMediaRefs, setDeletePromptMediaRefs] = useState<string[]>([]);
  const vcExportDirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const perm = await (h as any).queryPermission({ mode: "readwrite" });
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

  const flashComponent = useCallback((cid: string) => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashCidStore(cid);
    flashTimeoutRef.current = setTimeout(() => {
      // Only clear if we're still the active flash — don't clobber a newer one.
      const { flashCid: current } = peekSelection();
      if (current === cid) setFlashCidStore(null);
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
      /**
       * Fast path: plain typing has no effect here. Only Escape and
       * Alt/Ctrl/Meta combos trigger any branch below, so bail before the
       * `closest()` DOM walk. Every shortcut matched below is also declared
       * in `devid-shortcut-registry` so the `?` cheatsheet stays in sync.
       */
      if (e.key !== "Escape" && !e.altKey && !e.ctrlKey && !e.metaKey) return;
      if (!enabled && e.key !== "Escape") return;
      const target = e.target;
      const inEditable =
        target instanceof HTMLElement &&
        Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
      if (inEditable && e.key !== "Escape") return;

      if (matchShortcut(e, "devid.toggle")) {
        e.preventDefault();
        toggle();
        return;
      }
      if (matchShortcut(e, "devid.search")) {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (matchShortcut(e, "devid.resetAltMerge")) {
        e.preventDefault();
        setSameDepthMergeCids(highlightCid ? [highlightCid] : []);
        return;
      }
      if (matchShortcut(e, "devid.clearCtrlLane")) {
        e.preventDefault();
        setCtrlLaneCids([]);
        return;
      }
      if (matchShortcut(e, "devid.escape")) {
        clearAllSelection();
        setUpdatePromptMediaRefs([]);
        setDeletePromptMediaRefs([]);
        vcHandoffSnippetQueueRef.current = [];
        if (flashTimeoutRef.current) {
          clearTimeout(flashTimeoutRef.current);
          flashTimeoutRef.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, toggle, highlightCid]);

  const enabledValue = useMemo<DevIdEnabledContextValue>(
    () => ({ enabled, toggle }),
    [enabled, toggle],
  );

  const selectionValue = useMemo<DevIdSelectionContextValue>(
    () => ({
      highlightCid,
      setHighlightCid,
      sameDepthMergeCids,
      setSameDepthMergeCids,
      ctrlLaneCids,
      setCtrlLaneCids,
      flashCid,
      flashComponent,
    }),
    [
      highlightCid,
      sameDepthMergeCids,
      ctrlLaneCids,
      flashCid,
      flashComponent,
    ],
  );

  const settingsValue = useMemo<DevIdSettingsContextValue>(
    () => ({
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
      promptVerbosity,
      vcPanelHoverHintsEnabled,
      clearPersistedVcExportFolder,
      updatePromptMediaRefs,
      deletePromptMediaRefs,
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
    <DevIdEnabledContext.Provider value={enabledValue}>
      <DevIdSelectionContext.Provider value={selectionValue}>
        <DevIdSettingsContext.Provider value={settingsValue}>
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
        </DevIdSettingsContext.Provider>
      </DevIdSelectionContext.Provider>
    </DevIdEnabledContext.Provider>
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

/** Narrow hook: subscribes only to enabled / toggle. */
export function useDevIdEnabled(): DevIdEnabledContextValue {
  return useContext(DevIdEnabledContext);
}

/** Narrow hook: subscribes only to selection state (highlight, lanes, flash). */
export function useDevIdSelection(): DevIdSelectionContextValue {
  return useContext(DevIdSelectionContext);
}

/** Narrow hook: subscribes only to settings state (verbosity, media refs, VC handoff, dismissed bands, etc.). */
export function useDevIdSettings(): DevIdSettingsContextValue {
  return useContext(DevIdSettingsContext);
}

/**
 * Legacy merged hook preserved for callers that want everything at once. Prefer the
 * narrow slice hooks above in hot-path components (mounted in large numbers or re-rendered
 * often); this one re-renders whenever any of the three slices changes.
 */
export function useDevId(): DevIdContextValue {
  const enabledSlice = useContext(DevIdEnabledContext);
  const selectionSlice = useContext(DevIdSelectionContext);
  const settingsSlice = useContext(DevIdSettingsContext);
  return { ...enabledSlice, ...selectionSlice, ...settingsSlice };
}
