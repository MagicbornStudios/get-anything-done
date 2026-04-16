"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry, type RegistryEntry } from "./SectionRegistry";
import { Identified } from "./Identified";
import {
  DevIdAgentPromptDialog,
} from "./DevIdAgentPromptDialog";
import {
  buildDeletePrompt,
  buildDeletePromptMerged,
  buildUpdateLockedPrefix,
  buildUpdateLockedPrefixMerged,
} from "./DevIdPromptTemplates";
import {
  DEV_PANEL_BRAND_MARK,
  DEV_PANEL_LABEL,
  DEV_PANEL_SELF_ENTRY,
  DEV_PANEL_STABLE_CID,
} from "./dev-panel-constants";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { DevPanelHoverPromptActions } from "./DevPanelHoverPromptActions";
import { absolutePageUrl } from "./absolutePageUrl";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import { DevPanelPositionControls } from "./DevPanelPositionControls";
import { DevPanelListItem } from "./DevPanelListItem";
import { VcPanelHoverAnchorContext } from "./VcPanelHoverAnchorContext";
import { Button } from "@/components/ui/button";
import {
  collectScopedEntries,
  escapeCidSelector,
  queryByCid,
  readEntryFromElement,
  sortRegistryEntries,
} from "./devid-dom-scan";

function resolveEntriesOrdered(pool: RegistryEntry[], cids: string[]): RegistryEntry[] {
  return cids
    .map((c) => pool.find((e) => e.cid === c))
    .filter((e): e is RegistryEntry => Boolean(e));
}

/** Ordered merge list for handoff when ≥2 cids selected at the current depth slice. */
function resolveHandoffEntries(
  clicked: RegistryEntry,
  visible: RegistryEntry[],
  mergeCids: string[],
): RegistryEntry[] {
  const ordered = mergeCids
    .filter((c) => visible.some((e) => e.cid === c))
    .map((c) => visible.find((e) => e.cid === c)!)
    .filter((e): e is RegistryEntry => Boolean(e));
  if (ordered.length >= 2) return ordered;
  return [clicked];
}

const VC_HOVER_FRAMEWORK = <p className="text-muted-foreground">Framework wordmark on this strip.</p>;
const VC_HOVER_UPDATE = (
  <p>
    Mic: dictate additions to the update handoff for the selected target. Copies a locked prefix (route, label,
    source-search hints) plus your text.
  </p>
);
const VC_HOVER_DELETE = <p>Copy a delete handoff prompt for the selected target (route, label, and source-search hints).</p>;

function vcVerbosityHoverBody(isFull: boolean) {
  return isFull ? (
    <p>Prompts include full context. Click to switch to compact templates.</p>
  ) : (
    <p>Prompts use compact templates. Click to include full context.</p>
  );
}

type DevPanelProps =
  | { mode: "section" }
  | {
      mode: "band";
      cid: string;
      label: string;
      edge?: "top" | "bottom";
      corner?: "left" | "right";
      componentTag?: RegistryEntry["componentTag"];
      searchHint?: string;
    };

/** Depth pager — hint card docks beside the panel (`dockCorner`) like other VC chrome. */
function DevPanelDepthPager(props: {
  dockCorner: "left" | "right";
  currentDepth: number;
  visibleCount: number;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  /** Section scan cap from registry; omit in band mode. */
  maxScanDepth?: number;
}) {
  const {
    dockCorner,
    currentDepth,
    visibleCount,
    onPrev,
    onNext,
    prevDisabled,
    nextDisabled,
    maxScanDepth,
  } = props;

  return (
    <DevChromeHoverHint
      dockCorner={dockCorner}
      openDelay={100}
      closeDelay={80}
      contentClassName="p-3 [&_p+p]:mt-1.5"
      body={
        <>
          <p className="font-medium text-foreground">Depth {currentDepth}</p>
          <p className="text-muted-foreground">
            {visibleCount} landmark{visibleCount === 1 ? "" : "s"} in this slice. Chevrons step toward the section
            shell (back) or into nested{" "}
            <code className="rounded bg-muted/80 px-0.5 font-mono text-[9px]">Identified</code> blocks (forward).
          </p>
          {maxScanDepth != null ? (
            <p className="border-t border-border/50 pt-2 text-muted-foreground">Section scan window: depth ≤ {maxScanDepth}.</p>
          ) : null}
        </>
      }
    >
      <div
        className="ml-2 flex cursor-help items-center gap-1 rounded-sm px-0.5 py-0.5 ring-offset-background hover:bg-muted/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        tabIndex={0}
        aria-label={`Landmarks at nesting depth ${currentDepth}, ${visibleCount} in this slice`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          disabled={prevDisabled}
          onClick={onPrev}
          aria-label="Shallower nesting depth"
        >
          <ChevronLeft size={10} />
        </Button>
        <span className="w-16 text-center tabular-nums">
          d{currentDepth} - {visibleCount}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          disabled={nextDisabled}
          onClick={onNext}
          aria-label="Deeper nesting depth"
        >
          <ChevronRight size={10} />
        </Button>
      </div>
    </DevChromeHoverHint>
  );
}

function locateComponentOnPage(cid: string, flashComponent: (cid: string) => void) {
  const el = queryByCid(cid);
  if (!el) return;
  const hadTab = el.hasAttribute("tabindex");
  if (!hadTab) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  flashComponent(cid);
  window.setTimeout(() => {
    if (!hadTab) el.removeAttribute("tabindex");
  }, 1400);
}

/** Open Radix dialogs portaled to `body` are outside the section DOM; merge by `data-devid-band`. */
function collectBandEntriesWithPortals(
  bandCid: string,
  bandLabel: string,
  bandComponentTag: RegistryEntry["componentTag"] | undefined,
  bandSearchHint: string | undefined,
): RegistryEntry[] {
  const scope = queryByCid(bandCid);
  const fromSection = collectScopedEntries(scope, {
    includeScope: true,
    fallbackRoot: {
      cid: bandCid,
      label: bandLabel,
      depth: 0,
      componentTag: bandComponentTag,
      searchHint: bandSearchHint,
    },
  });
  if (typeof document === "undefined") return fromSection;

  /** Radix Content may not expose `role="dialog"` on the same node as our attrs in all versions — match by band + open state only. */
  let dialogRoots: HTMLElement[];
  try {
    dialogRoots = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-devid-band="${escapeCidSelector(bandCid)}"]`),
    ).filter((el) => el.getAttribute("data-state") === "open");
  } catch {
    return fromSection;
  }

  const fromDialogs: RegistryEntry[] = [];
  for (const root of dialogRoots) {
    fromDialogs.push(...collectScopedEntries(root, { includeScope: false }));
  }

  const merged = new Map<string, RegistryEntry>();
  for (const e of fromDialogs) merged.set(e.cid, e);
  for (const e of fromSection) merged.set(e.cid, e);
  return sortRegistryEntries(Array.from(merged.values()));
}

export function DevPanel(props: DevPanelProps) {
  const mode = props.mode;
  const isBand = mode === "band";
  const bandCid = isBand ? props.cid : "";
  const bandLabel = isBand ? props.label : "";
  const bandEdge = isBand ? props.edge ?? "top" : "top";
  const bandCorner = isBand ? props.corner ?? "right" : "right";
  const bandComponentTag = isBand ? props.componentTag : undefined;
  const bandSearchHint = isBand ? props.searchHint : undefined;
  const pathname = usePathname() ?? "";
  const {
    enabled,
    setHighlightCid,
    flashComponent,
    highlightCid,
    sameDepthMergeCids,
    setSameDepthMergeCids,
    ctrlLaneCids,
    setCtrlLaneCids,
    promptVerbosity,
    setPromptVerbosity,
  } = useDevId();
  const registry = useSectionRegistry();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const vcPanelHoverAnchorRef = useRef<HTMLDivElement | null>(null);
  const highlightPrevRef = useRef<string | null>(null);
  const highlightDepthSyncRef = useRef<string | null>(null);

  const [handoffEntries, setHandoffEntries] = useState<RegistryEntry[] | null>(null);
  const [headerCopied, setHeaderCopied] = useState<"update" | "delete" | "cid" | null>(null);
  const [mountedSectionEntry, setMountedSectionEntry] = useState<RegistryEntry | null>(null);
  const [bandEntries, setBandEntries] = useState<RegistryEntry[]>([]);
  const [depthIndex, setDepthIndex] = useState(0);
  const [activeCid, setActiveCid] = useState<string>(bandCid);
  const [sectionDepthIndex, setSectionDepthIndex] = useState(0);
  const [sectionEdge, setSectionEdge] = useState<"top" | "bottom">("top");
  const [sectionCorner, setSectionCorner] = useState<"left" | "right">("right");
  const [compactEdge, setCompactEdge] = useState<"top" | "bottom">(bandEdge);
  const [compactCorner, setCompactCorner] = useState<"left" | "right">(bandCorner);
  const [chromeUpdateCopied, setChromeUpdateCopied] = useState(false);

  const sortedSectionEntries = useMemo(
    () => (registry ? sortRegistryEntries(registry.entries) : []),
    [registry],
  );

  useEffect(() => {
    if (mode !== "section" || !registry) return;
    const host = panelRef.current;
    const section = host?.closest("section[data-cid]") as HTMLElement | null;
    setMountedSectionEntry(section ? readEntryFromElement(section, 0) : null);
  }, [mode, registry, pathname, sortedSectionEntries.length]);

  useEffect(() => {
    if (mode !== "band") return;
    const run = () => {
      setBandEntries(
        collectBandEntriesWithPortals(bandCid, bandLabel, bandComponentTag, bandSearchHint),
      );
    };
    run();
    const raf = requestAnimationFrame(run);
    const obs = new MutationObserver(run);
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "data-devid-band", "data-cid"],
    });
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [mode, pathname, bandCid, bandLabel, bandComponentTag, bandSearchHint]);

  useEffect(() => {
    if (mode !== "band") return;
    setCompactEdge(bandEdge);
    setCompactCorner(bandCorner);
  }, [mode, bandCid, bandEdge, bandCorner]);

  useEffect(() => {
    if (mode !== "band" || !bandCid) return;
    const raw = window.localStorage.getItem(`devid.panelpos.${bandCid}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        edge?: "top" | "bottom";
        corner?: "left" | "right";
      };
      if (parsed.edge === "top" || parsed.edge === "bottom") setCompactEdge(parsed.edge);
      if (parsed.corner === "left" || parsed.corner === "right") setCompactCorner(parsed.corner);
    } catch {
      // ignore invalid persisted values
    }
  }, [mode, bandCid]);

  useEffect(() => {
    if (mode !== "band" || !bandCid) return;
    window.localStorage.setItem(
      `devid.panelpos.${bandCid}`,
      JSON.stringify({ edge: compactEdge, corner: compactCorner }),
    );
  }, [mode, bandCid, compactEdge, compactCorner]);

  useEffect(() => {
    if (mode !== "section") return;
    const key = mountedSectionEntry?.cid ?? pathname ?? "route";
    const raw = window.localStorage.getItem(`devid.panelpos.section.${key}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        edge?: "top" | "bottom";
        corner?: "left" | "right";
      };
      if (parsed.edge === "top" || parsed.edge === "bottom") setSectionEdge(parsed.edge);
      if (parsed.corner === "left" || parsed.corner === "right") setSectionCorner(parsed.corner);
    } catch {
      // ignore invalid persisted values
    }
  }, [mode, mountedSectionEntry?.cid, pathname]);

  useEffect(() => {
    if (mode !== "section") return;
    const key = mountedSectionEntry?.cid ?? pathname ?? "route";
    window.localStorage.setItem(
      `devid.panelpos.section.${key}`,
      JSON.stringify({ edge: sectionEdge, corner: sectionCorner }),
    );
  }, [mode, mountedSectionEntry?.cid, pathname, sectionEdge, sectionCorner]);

  const locate = useCallback(
    (cid: string) => locateComponentOnPage(cid, flashComponent),
    [flashComponent],
  );

  const sectionEntries = useMemo(() => {
    if (mode !== "section") return [] as RegistryEntry[];
    const mountedSectionCid = mountedSectionEntry?.cid;
    const hasMounted = mountedSectionCid
      ? sortedSectionEntries.some((entry) => entry.cid === mountedSectionCid)
      : false;
    return mountedSectionEntry && !hasMounted
      ? [mountedSectionEntry, ...sortedSectionEntries]
      : sortedSectionEntries;
  }, [mode, mountedSectionEntry, sortedSectionEntries]);

  const bandDepths = useMemo(
    () => Array.from(new Set(bandEntries.map((e) => e.depth))).sort((a, b) => a - b),
    [bandEntries],
  );

  const bandCurrentDepth = bandDepths[depthIndex] ?? 0;
  const bandVisibleEntries = bandEntries.filter((e) => e.depth === bandCurrentDepth);
  const sectionDepths = useMemo(
    () => Array.from(new Set(sectionEntries.map((e) => e.depth))).sort((a, b) => a - b),
    [sectionEntries],
  );
  const sectionCurrentDepth = sectionDepths[sectionDepthIndex] ?? 0;
  const sectionVisibleEntries = sectionEntries.filter((e) => e.depth === sectionCurrentDepth);

  useEffect(() => {
    setSameDepthMergeCids((prev) => {
      if (mode === "section") {
        return prev.filter((cid) =>
          sectionEntries.some((e) => e.cid === cid && e.depth === sectionCurrentDepth),
        );
      }
      if (mode === "band") {
        return prev.filter((cid) =>
          bandEntries.some((e) => e.cid === cid && e.depth === bandCurrentDepth),
        );
      }
      return prev;
    });
  }, [
    mode,
    sectionDepthIndex,
    depthIndex,
    sectionCurrentDepth,
    bandCurrentDepth,
    sectionEntries,
    bandEntries,
    setSameDepthMergeCids,
  ]);

  useEffect(() => {
    if (mode !== "band") return;
    if (depthIndex >= bandDepths.length) setDepthIndex(0);
  }, [mode, depthIndex, bandDepths.length]);

  useEffect(() => {
    if (mode !== "section") return;
    if (sectionDepthIndex >= sectionDepths.length) setSectionDepthIndex(0);
  }, [mode, sectionDepthIndex, sectionDepths.length]);

  useEffect(() => {
    if (mode !== "band") return;
    if (!bandEntries.length) {
      setActiveCid(bandCid);
      return;
    }
    if (!activeCid || !bandEntries.some((entry) => entry.cid === activeCid)) {
      setActiveCid(bandEntries[0]?.cid ?? bandCid);
    }
  }, [mode, bandEntries, activeCid, bandCid]);

  useEffect(() => {
    if (mode !== "section") return;
    if (!sectionEntries.length) {
      setActiveCid(mountedSectionEntry?.cid ?? DEV_PANEL_STABLE_CID);
      return;
    }
    if (!activeCid || !sectionEntries.some((entry) => entry.cid === activeCid)) {
      const preferred =
        sectionEntries.find((entry) => entry.depth > 0) ??
        sectionEntries.find((entry) => entry.cid !== mountedSectionEntry?.cid) ??
        sectionEntries[0];
      setActiveCid(preferred?.cid ?? mountedSectionEntry?.cid ?? DEV_PANEL_STABLE_CID);
    }
  }, [mode, sectionEntries, activeCid, mountedSectionEntry]);

  /** Alt+click on any Identified sets `highlightCid`; sync depth only when highlight target changes. */
  useEffect(() => {
    if (!highlightCid) return;
    if (highlightDepthSyncRef.current === highlightCid) return;
    highlightDepthSyncRef.current = highlightCid;
    if (mode === "band") {
      const entry = bandEntries.find((e) => e.cid === highlightCid);
      if (!entry) return;
      setActiveCid(highlightCid);
      const di = bandDepths.indexOf(entry.depth);
      if (di >= 0) setDepthIndex(di);
      return;
    }
    if (mode === "section") {
      const entry = sectionEntries.find((e) => e.cid === highlightCid);
      if (!entry) return;
      setActiveCid(highlightCid);
      const di = sectionDepths.indexOf(entry.depth);
      if (di >= 0) setSectionDepthIndex(di);
    }
  }, [highlightCid, mode, bandEntries, sectionEntries, bandDepths, sectionDepths]);

  /** When global highlight clears (Escape, or Alt+click same landmark), reset panel target to band/section shell. */
  useEffect(() => {
    const prev = highlightPrevRef.current;
    highlightPrevRef.current = highlightCid;
    if (!(highlightCid === null && prev != null)) return;
    highlightDepthSyncRef.current = null;
    if (mode === "band") {
      setActiveCid(bandCid);
      setDepthIndex(0);
      return;
    }
    if (mode === "section") {
      const fallback =
        mountedSectionEntry?.cid ??
        sortedSectionEntries[0]?.cid ??
        DEV_PANEL_STABLE_CID;
      setActiveCid(fallback);
      setSectionDepthIndex(0);
    }
  }, [
    highlightCid,
    mode,
    bandCid,
    mountedSectionEntry?.cid,
    sortedSectionEntries,
  ]);

  const sectionTarget =
    mode === "section"
      ? sectionEntries.find((entry) => entry.cid === activeCid) ?? null
      : bandEntries.find((entry) => entry.cid === activeCid) ??
        (mode === "band"
          ? {
              cid: bandCid,
              label: bandLabel,
              depth: 0,
              componentTag: bandComponentTag,
              searchHint: bandSearchHint,
            }
          : null);

  const activeTargetCid =
    mode === "section"
      ? activeCid ?? mountedSectionEntry?.cid ?? DEV_PANEL_STABLE_CID
      : sectionTarget?.cid ?? activeCid ?? bandCid;

  const panelHandoffEntriesResolved = useMemo(() => {
    if (!sectionTarget) return [] as RegistryEntry[];
    const visible = mode === "section" ? sectionVisibleEntries : bandVisibleEntries;
    return resolveHandoffEntries(sectionTarget, visible, sameDepthMergeCids);
  }, [mode, sectionTarget, sectionVisibleEntries, bandVisibleEntries, sameDepthMergeCids]);

  const ctrlLaneEntriesResolved = useMemo(() => {
    const pool = mode === "section" ? sectionEntries : bandEntries;
    return resolveEntriesOrdered(pool, ctrlLaneCids);
  }, [mode, sectionEntries, bandEntries, ctrlLaneCids]);

  const panelTargetSummary = (() => {
    const altSummary =
      panelHandoffEntriesResolved.length >= 2
        ? `${panelHandoffEntriesResolved.length} Alt @ d${panelHandoffEntriesResolved[0]?.depth ?? 0}`
        : (sectionTarget?.label ?? (mode === "band" ? bandLabel : "None"));
    const ctrlHint =
      ctrlLaneEntriesResolved.length > 0 ? ` · Ctrl×${ctrlLaneEntriesResolved.length}` : "";
    return `${altSummary}${ctrlHint}`;
  })();

  const finalizeUpdatePromptCopy = useCallback(
    (transcript: string) => {
      if (!panelHandoffEntriesResolved.length) return;
      const prefix = buildUpdateLockedPrefixMerged(
        absolutePageUrl(pathname),
        panelHandoffEntriesResolved,
        promptVerbosity,
        ctrlLaneEntriesResolved,
      );
      const resolved = `${prefix}\n${transcript.trim()}`;
      navigator.clipboard?.writeText(resolved).catch(() => {});
      setHeaderCopied("update");
      window.setTimeout(() => setHeaderCopied(null), 1200);
      toast.success(transcript.trim() ? "Update prompt copied" : "Update template copied");
    },
    [pathname, promptVerbosity, panelHandoffEntriesResolved, ctrlLaneEntriesResolved],
  );

  const { listening, interim, toggle: toggleUpdatePromptWithSpeech } = useDictatedPromptCopy({
    onFinalize: finalizeUpdatePromptCopy,
  });

  const finalizeChromeSelfPrompt = useCallback(
    (transcript: string) => {
      const prefix = buildUpdateLockedPrefix(
        absolutePageUrl(pathname),
        DEV_PANEL_SELF_ENTRY.label,
        DEV_PANEL_SELF_ENTRY.cid,
        DEV_PANEL_SELF_ENTRY.componentTag ?? "Identified",
        DEV_PANEL_SELF_ENTRY.searchHint,
        undefined,
        promptVerbosity,
      );
      const resolved = `${prefix}\n${transcript.trim()}`;
      navigator.clipboard?.writeText(resolved).catch(() => {});
      setChromeUpdateCopied(true);
      window.setTimeout(() => setChromeUpdateCopied(false), 1200);
      toast.success(transcript.trim() ? "Update prompt copied" : "Update template copied");
    },
    [pathname, promptVerbosity],
  );

  const {
    listening: listeningChrome,
    interim: interimChrome,
    toggle: toggleChromeSpeech,
  } = useDictatedPromptCopy({
    onFinalize: finalizeChromeSelfPrompt,
    listeningMessage: "Listening for panel chrome…",
  });

  const copyResolvedDeletePrompt = useCallback(() => {
    if (!panelHandoffEntriesResolved.length) return;
    const resolved = buildDeletePromptMerged(
      absolutePageUrl(pathname),
      panelHandoffEntriesResolved,
      promptVerbosity,
      ctrlLaneEntriesResolved,
    );
    navigator.clipboard?.writeText(resolved).catch(() => {});
    setHeaderCopied("delete");
    window.setTimeout(() => setHeaderCopied(null), 1200);
    toast.success("Delete prompt copied");
  }, [pathname, promptVerbosity, panelHandoffEntriesResolved, ctrlLaneEntriesResolved]);

  const handleSectionRowClick = useCallback(
    (entry: RegistryEntry, e: MouseEvent<HTMLButtonElement>) => {
      const visible = sectionVisibleEntries;

      if (e.altKey) {
        setSameDepthMergeCids((prev) => {
          const allowed = new Set(visible.map((x) => x.cid));
          if (!allowed.has(entry.cid)) return prev;
          if (prev.includes(entry.cid)) {
            const next = prev.filter((c) => c !== entry.cid);
            return next.length > 0 ? next : [entry.cid];
          }
          return [...prev.filter((c) => allowed.has(c)), entry.cid];
        });
        setActiveCid(entry.cid);
        setHighlightCid(entry.cid);
        locate(entry.cid);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        setCtrlLaneCids((prev) => {
          if (prev.includes(entry.cid)) return prev.filter((c) => c !== entry.cid);
          return [...prev, entry.cid];
        });
        locate(entry.cid);
        return;
      }

      setCtrlLaneCids([]);
      setSameDepthMergeCids([entry.cid]);
      setActiveCid(entry.cid);
      setHighlightCid(entry.cid);
      locate(entry.cid);
    },
    [sectionVisibleEntries, setSameDepthMergeCids, setCtrlLaneCids, setActiveCid, setHighlightCid, locate],
  );

  const handleBandRowClick = useCallback(
    (entry: RegistryEntry, e: MouseEvent<HTMLButtonElement>) => {
      const visible = bandVisibleEntries;

      if (e.altKey) {
        setSameDepthMergeCids((prev) => {
          const allowed = new Set(visible.map((x) => x.cid));
          if (!allowed.has(entry.cid)) return prev;
          if (prev.includes(entry.cid)) {
            const next = prev.filter((c) => c !== entry.cid);
            return next.length > 0 ? next : [entry.cid];
          }
          return [...prev.filter((c) => allowed.has(c)), entry.cid];
        });
        setActiveCid(entry.cid);
        setHighlightCid(entry.cid);
        locate(entry.cid);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        setCtrlLaneCids((prev) => {
          if (prev.includes(entry.cid)) return prev.filter((c) => c !== entry.cid);
          return [...prev, entry.cid];
        });
        locate(entry.cid);
        return;
      }

      setCtrlLaneCids([]);
      setSameDepthMergeCids([entry.cid]);
      setActiveCid(entry.cid);
      setHighlightCid(entry.cid);
      locate(entry.cid);
    },
    [bandVisibleEntries, setSameDepthMergeCids, setCtrlLaneCids, setActiveCid, setHighlightCid, locate],
  );

  const copyValue = (value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setHeaderCopied("cid");
    window.setTimeout(() => {
      setHeaderCopied((curr) => (curr === "cid" ? null : curr));
    }, 900);
  };

  const copyEntry = (entry: RegistryEntry) => copyValue(entry.searchHint ?? entry.cid);

  if (!enabled) return null;
  if (mode === "section" && !registry) return null;

  if (mode === "section") {
    return (
      <>
        <DevIdAgentPromptDialog
          open={handoffEntries != null}
          onOpenChange={(v) => !v && setHandoffEntries(null)}
          entries={handoffEntries}
          ctrlReferenceEntries={ctrlLaneEntriesResolved}
          pathname={pathname}
        />
        <div
          ref={panelRef}
          className={[
            "pointer-events-none absolute inset-0 z-[80] opacity-0 transition-opacity duration-200 ease-out",
            "group-hover/site-section:opacity-100",
            "group-focus-within/site-section:opacity-100",
          ].join(" ")}
          aria-hidden={!enabled}
        >
          <div
            className={[
              "pointer-events-none sticky z-[80] w-full",
              sectionEdge === "top" ? "top-2" : "bottom-2",
            ].join(" ")}
          >
            <Identified
              as={DEV_PANEL_LABEL}
              stableCid={DEV_PANEL_STABLE_CID}
              register={false}
              className={[
                "pointer-events-auto w-72 max-w-[85vw] overscroll-contain rounded-md border border-accent/40 bg-background/95 px-2 py-1 shadow-lg backdrop-blur",
                sectionCorner === "right" ? "ml-auto mr-2" : "ml-2",
              ].join(" ")}
              depth={0}
            >
              <VcPanelHoverAnchorContext.Provider value={vcPanelHoverAnchorRef}>
                <div ref={vcPanelHoverAnchorRef} className="flex min-h-0 min-w-0 flex-col gap-0">
                  <div className="flex items-start justify-between gap-2 text-[10px]">
                <div className="group/paneltitle min-w-0 flex-1">
                  <div className="relative h-6 w-full min-w-0">
                    <p className="absolute inset-0 flex items-center font-semibold uppercase tracking-wide text-accent transition-opacity group-hover/paneltitle:pointer-events-none group-hover/paneltitle:opacity-0">
                      {DEV_PANEL_LABEL}
                    </p>
                    <div className="absolute inset-0 flex h-6 items-center gap-0.5 opacity-0 transition-opacity group-hover/paneltitle:pointer-events-auto group-hover/paneltitle:opacity-100">
                      <DevPanelHoverPromptActions
                        selfEntry={DEV_PANEL_SELF_ENTRY}
                        pathname={pathname}
                        promptVerbosity={promptVerbosity}
                        onAgentPrompt={(e) => setHandoffEntries([e])}
                        dockCorner={sectionCorner}
                        externalDictation={{
                          listening: listeningChrome,
                          interim: interimChrome,
                          toggle: toggleChromeSpeech,
                        }}
                        updateJustCopied={chromeUpdateCopied}
                      />
                    </div>
                  </div>
                  <p className="truncate text-muted-foreground">
                    Section scan {sectionEntries.length} items
                  </p>
                </div>
                <DevChromeHoverHint dockCorner={sectionCorner} body={VC_HOVER_FRAMEWORK}>
                  <p className="shrink-0 max-w-[5.5rem] cursor-help text-right text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground/85">
                    {DEV_PANEL_BRAND_MARK}
                  </p>
                </DevChromeHoverHint>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <DevChromeHoverHint dockCorner={sectionCorner} body={VC_HOVER_UPDATE}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={toggleUpdatePromptWithSpeech}
                    disabled={!panelHandoffEntriesResolved.length}
                    className="h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide"
                  >
                    {headerCopied === "update" ? (
                      <Check size={12} />
                    ) : listening ? (
                      <MicOff size={12} />
                    ) : (
                      <Mic size={12} />
                    )}
                    Update
                  </Button>
                </DevChromeHoverHint>
                <DevChromeHoverHint dockCorner={sectionCorner} body={VC_HOVER_DELETE}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyResolvedDeletePrompt}
                    disabled={!panelHandoffEntriesResolved.length}
                    className="h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide"
                  >
                    {headerCopied === "delete" ? <Check size={12} /> : <Trash2 size={12} />}
                    Delete
                  </Button>
                </DevChromeHoverHint>
                <DevChromeHoverHint dockCorner={sectionCorner} body={vcVerbosityHoverBody(promptVerbosity === "full")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPromptVerbosity((v) => (v === "full" ? "compact" : "full"))}
                    className="h-6 px-1.5 text-[9px] font-semibold uppercase tracking-wide"
                  >
                    {promptVerbosity === "compact" ? "Short" : "Full"}
                  </Button>
                </DevChromeHoverHint>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="text-muted-foreground">Target - </span>
                    <span className="font-medium text-foreground" title={panelTargetSummary}>
                      {panelTargetSummary}
                    </span>
                  </p>
                </div>
                <DevPanelDepthPager
                  dockCorner={sectionCorner}
                  currentDepth={sectionCurrentDepth}
                  visibleCount={sectionVisibleEntries.length}
                  onPrev={() => setSectionDepthIndex((v) => Math.max(0, v - 1))}
                  onNext={() =>
                    setSectionDepthIndex((v) => Math.min(sectionDepths.length - 1, v + 1))
                  }
                  prevDisabled={sectionDepthIndex <= 0}
                  nextDisabled={sectionDepthIndex >= sectionDepths.length - 1}
                  maxScanDepth={registry?.maxDepth}
                />
              </div>
              <div className="mt-1 max-h-24 min-h-0 space-y-1 overflow-y-auto overscroll-y-contain pr-1">
                {sectionVisibleEntries.map((entry) => (
                  <DevPanelListItem
                    key={entry.cid}
                    dockCorner={sectionCorner}
                    entry={entry}
                    active={activeTargetCid === entry.cid}
                    altMergeSelected={
                      sameDepthMergeCids.includes(entry.cid) && activeTargetCid !== entry.cid
                    }
                    ctrlLaneSelected={ctrlLaneCids.includes(entry.cid)}
                    onRowClick={(e) => handleSectionRowClick(entry, e)}
                    onCopy={() => copyEntry(entry)}
                    onPrompt={() =>
                      setHandoffEntries(resolveHandoffEntries(entry, sectionVisibleEntries, sameDepthMergeCids))
                    }
                  />
                ))}
              </div>
              {listening || listeningChrome ? (
                <p className="mt-1 max-w-full truncate text-[10px] text-emerald-300">
                  <span className="font-semibold">Live — </span>
                  {(listening ? interim : interimChrome) || "\u00a0"}
                </p>
              ) : null}
              <div className="mt-1 text-[10px] text-muted-foreground">
                depth {"<="} {registry?.maxDepth ?? 0}
              </div>
              <div className="ml-2 flex items-center gap-1">
                <DevPanelPositionControls
                  edge={sectionEdge}
                  corner={sectionCorner}
                  onEdgeChange={setSectionEdge}
                  onCornerChange={setSectionCorner}
                />
              </div>
                </div>
              </VcPanelHoverAnchorContext.Provider>
            </Identified>
          </div>
        </div>
      </>
    );
  }

  const edge = compactEdge;
  const corner = compactCorner;

  return (
    <>
      <DevIdAgentPromptDialog
        open={handoffEntries != null}
        onOpenChange={(v) => !v && setHandoffEntries(null)}
        entries={handoffEntries}
        ctrlReferenceEntries={ctrlLaneEntriesResolved}
        pathname={pathname}
      />
      <div
        className={[
          "pointer-events-none absolute inset-0 z-[80] opacity-0 transition-opacity duration-200",
          "group-hover/site-band:opacity-100",
          "group-focus-within/site-band:opacity-100",
        ].join(" ")}
      >
        <div
          className={[
            "pointer-events-none sticky z-[80] w-full",
            edge === "top" ? "top-2" : "bottom-2",
          ].join(" ")}
        >
          <Identified
            as={DEV_PANEL_LABEL}
            stableCid={DEV_PANEL_STABLE_CID}
            register={false}
            className={[
              "pointer-events-auto w-72 max-w-[85vw] overscroll-contain rounded-md border border-accent/40 bg-background/95 px-2 py-1 shadow-lg backdrop-blur",
              corner === "right" ? "ml-auto mr-2" : "ml-2",
            ].join(" ")}
            depth={0}
          >
            <VcPanelHoverAnchorContext.Provider value={vcPanelHoverAnchorRef}>
              <div ref={vcPanelHoverAnchorRef} className="flex min-h-0 min-w-0 flex-col gap-0">
            <div className="flex items-start justify-between gap-2 text-[10px]">
              <div className="group/paneltitle min-w-0 flex-1">
                <div className="relative h-6 w-full min-w-0">
                  <p className="absolute inset-0 flex items-center font-semibold uppercase tracking-wide text-accent transition-opacity group-hover/paneltitle:pointer-events-none group-hover/paneltitle:opacity-0">
                    {DEV_PANEL_LABEL}
                  </p>
                  <div className="absolute inset-0 flex h-6 items-center gap-0.5 opacity-0 transition-opacity group-hover/paneltitle:pointer-events-auto group-hover/paneltitle:opacity-100">
                    <DevPanelHoverPromptActions
                      selfEntry={DEV_PANEL_SELF_ENTRY}
                      pathname={pathname}
                      promptVerbosity={promptVerbosity}
                      onAgentPrompt={(e) => setHandoffEntries([e])}
                      size="band"
                      dockCorner={corner}
                      externalDictation={{
                        listening: listeningChrome,
                        interim: interimChrome,
                        toggle: toggleChromeSpeech,
                      }}
                      updateJustCopied={chromeUpdateCopied}
                    />
                  </div>
                </div>
                <p className="truncate text-muted-foreground">
                  {bandLabel} · {bandEntries.length} items
                </p>
              </div>
              <DevChromeHoverHint dockCorner={corner} body={VC_HOVER_FRAMEWORK}>
                <p className="shrink-0 max-w-[5.5rem] cursor-help text-right text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground/85">
                  {DEV_PANEL_BRAND_MARK}
                </p>
              </DevChromeHoverHint>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
              <DevChromeHoverHint dockCorner={corner} body={VC_HOVER_UPDATE}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleUpdatePromptWithSpeech}
                  disabled={!panelHandoffEntriesResolved.length}
                  className="h-6 gap-1 px-1.5 text-[10px]"
                >
                  {headerCopied === "update" ? (
                    <Check size={11} />
                  ) : listening ? (
                    <MicOff size={11} />
                  ) : (
                    <Mic size={11} />
                  )}
                  Update
                </Button>
              </DevChromeHoverHint>
              <DevChromeHoverHint dockCorner={corner} body={VC_HOVER_DELETE}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyResolvedDeletePrompt}
                  disabled={!panelHandoffEntriesResolved.length}
                  className="h-6 gap-1 px-1.5 text-[10px]"
                >
                  {headerCopied === "delete" ? <Check size={11} /> : <Trash2 size={11} />}
                  Delete
                </Button>
              </DevChromeHoverHint>
              <DevChromeHoverHint dockCorner={corner} body={vcVerbosityHoverBody(promptVerbosity === "full")}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPromptVerbosity((v) => (v === "full" ? "compact" : "full"))}
                  className="h-6 px-1.5 text-[9px] font-semibold uppercase tracking-wide"
                >
                  {promptVerbosity === "compact" ? "Short" : "Full"}
                </Button>
              </DevChromeHoverHint>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="min-w-0">
                <p className="truncate">
                  <span className="text-muted-foreground">Target - </span>
                  <span className="font-medium text-foreground" title={panelTargetSummary}>
                    {panelTargetSummary}
                  </span>
                </p>
              </div>
              <DevPanelDepthPager
                dockCorner={corner}
                currentDepth={bandCurrentDepth}
                visibleCount={bandVisibleEntries.length}
                onPrev={() => setDepthIndex((v) => Math.max(0, v - 1))}
                onNext={() => setDepthIndex((v) => Math.min(bandDepths.length - 1, v + 1))}
                prevDisabled={depthIndex <= 0}
                nextDisabled={depthIndex >= bandDepths.length - 1}
              />
            </div>
            <div className="mt-1 max-h-24 min-h-0 space-y-1 overflow-y-auto overscroll-y-contain pr-1">
              {bandVisibleEntries.map((entry) => (
                <DevPanelListItem
                  key={entry.cid}
                  dockCorner={corner}
                  entry={entry}
                  active={activeTargetCid === entry.cid}
                  altMergeSelected={
                    sameDepthMergeCids.includes(entry.cid) && activeTargetCid !== entry.cid
                  }
                  ctrlLaneSelected={ctrlLaneCids.includes(entry.cid)}
                  onRowClick={(e) => handleBandRowClick(entry, e)}
                  onCopy={() => copyEntry(entry)}
                  onPrompt={() =>
                    setHandoffEntries(resolveHandoffEntries(entry, bandVisibleEntries, sameDepthMergeCids))
                  }
                />
              ))}
            </div>
            {listening || listeningChrome ? (
              <p className="mt-1 max-w-full truncate text-[10px] text-emerald-300">
                <span className="font-semibold">Live — </span>
                {(listening ? interim : interimChrome) || "\u00a0"}
              </p>
            ) : null}
            <DevPanelPositionControls
              edge={compactEdge}
              corner={compactCorner}
              onEdgeChange={setCompactEdge}
              onCornerChange={setCompactCorner}
            />
              </div>
            </VcPanelHoverAnchorContext.Provider>
          </Identified>
        </div>
      </div>
    </>
  );
}
