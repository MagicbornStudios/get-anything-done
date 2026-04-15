"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { buildDeletePrompt, buildUpdateLockedPrefix, type PromptVerbosity } from "./DevIdPromptTemplates";
import {
  DEV_PANEL_BRAND_MARK,
  DEV_PANEL_LABEL,
  DEV_PANEL_SELF_ENTRY,
  DEV_PANEL_STABLE_CID,
} from "./dev-panel-constants";
import { DevPanelHoverPromptActions } from "./DevPanelHoverPromptActions";
import { absolutePageUrl } from "./absolutePageUrl";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import { DevPanelPositionControls } from "./DevPanelPositionControls";
import { DevPanelListItem } from "./DevPanelListItem";
import { Button } from "@/components/ui/button";
import {
  collectScopedEntries,
  escapeCidSelector,
  queryByCid,
  readEntryFromElement,
  sortRegistryEntries,
} from "./devid-dom-scan";

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
  const { enabled, setHighlightCid, flashComponent, highlightCid } = useDevId();
  const registry = useSectionRegistry();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const highlightPrevRef = useRef<string | null>(null);
  const highlightDepthSyncRef = useRef<string | null>(null);

  const [promptEntry, setPromptEntry] = useState<RegistryEntry | null>(null);
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
  const [promptVerbosity, setPromptVerbosity] = useState<PromptVerbosity>("full");
  const [chromeUpdateCopied, setChromeUpdateCopied] = useState(false);

  const sortedSectionEntries = useMemo(
    () => (registry ? sortRegistryEntries(registry.entries) : []),
    [registry],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem("devid.prompt.verbosity");
    if (raw === "compact" || raw === "full") setPromptVerbosity(raw);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("devid.prompt.verbosity", promptVerbosity);
  }, [promptVerbosity]);

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

  const finalizeUpdatePromptCopy = (transcript: string) => {
    if (!sectionTarget) return;
    const prefix = buildUpdateLockedPrefix(
      absolutePageUrl(pathname),
      sectionTarget.label,
      sectionTarget.cid,
      sectionTarget.componentTag ?? "Identified",
      sectionTarget.searchHint,
      undefined,
      promptVerbosity,
    );
    const resolved = `${prefix}\n${transcript.trim()}`;
    navigator.clipboard?.writeText(resolved).catch(() => {});
    setHeaderCopied("update");
    window.setTimeout(() => setHeaderCopied(null), 1200);
    toast.success(transcript.trim() ? "Update prompt copied" : "Update template copied");
  };

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

  const copyResolvedDeletePrompt = () => {
    if (!sectionTarget) return;
    const resolved = buildDeletePrompt(
      absolutePageUrl(pathname),
      sectionTarget.label,
      sectionTarget.cid,
      sectionTarget.componentTag ?? "Identified",
      sectionTarget.searchHint,
      undefined,
      promptVerbosity,
    );
    navigator.clipboard?.writeText(resolved).catch(() => {});
    setHeaderCopied("delete");
    window.setTimeout(() => setHeaderCopied(null), 1200);
    toast.success("Delete prompt copied");
  };

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
          open={promptEntry != null}
          onOpenChange={(v) => !v && setPromptEntry(null)}
          entry={promptEntry}
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
                "pointer-events-auto w-72 max-w-[85vw] rounded-md border border-accent/40 bg-background/95 px-2 py-1 shadow-lg backdrop-blur",
                sectionCorner === "right" ? "ml-auto mr-2" : "ml-2",
              ].join(" ")}
              depth={0}
            >
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
                        onAgentPrompt={(e) => setPromptEntry(e)}
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
                <p
                  className="shrink-0 max-w-[5.5rem] text-right text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground/85"
                  title="Framework"
                >
                  {DEV_PANEL_BRAND_MARK}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Mic: dictate additions to the update handoff for the selected target. Copies a locked prefix (route, label, source-search hints) plus your text."
                  onClick={toggleUpdatePromptWithSpeech}
                  disabled={!sectionTarget}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Copy a delete handoff prompt for the selected target (route, label, and source-search hints)."
                  onClick={copyResolvedDeletePrompt}
                  disabled={!sectionTarget}
                  className="h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide"
                >
                  {headerCopied === "delete" ? <Check size={12} /> : <Trash2 size={12} />}
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title={
                    promptVerbosity === "full"
                      ? "Prompts include full context. Click for compact templates."
                      : "Prompts use compact templates. Click for full context."
                  }
                  onClick={() => setPromptVerbosity((v) => (v === "full" ? "compact" : "full"))}
                  className="h-6 px-1.5 text-[9px] font-semibold uppercase tracking-wide"
                >
                  {promptVerbosity === "compact" ? "Short" : "Full"}
                </Button>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="text-muted-foreground">Target - </span>
                    <span className="font-medium text-foreground">
                      {sectionTarget?.label ?? "None"}
                    </span>
                  </p>
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5"
                    disabled={sectionDepthIndex <= 0}
                    onClick={() => setSectionDepthIndex((v) => Math.max(0, v - 1))}
                  >
                    <ChevronLeft size={10} />
                  </Button>
                  <span className="w-16 text-center">
                    d{sectionCurrentDepth} - {sectionVisibleEntries.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5"
                    disabled={sectionDepthIndex >= sectionDepths.length - 1}
                    onClick={() =>
                      setSectionDepthIndex((v) => Math.min(sectionDepths.length - 1, v + 1))
                    }
                  >
                    <ChevronRight size={10} />
                  </Button>
                </div>
              </div>
              <div className="mt-1 max-h-24 space-y-1 overflow-auto pr-1">
                {sectionVisibleEntries.map((entry) => (
                  <DevPanelListItem
                    key={entry.cid}
                    entry={entry}
                    active={activeTargetCid === entry.cid}
                    onSelect={() => {
                      setActiveCid(entry.cid);
                      setHighlightCid(entry.cid);
                      locate(entry.cid);
                    }}
                    onCopy={() => copyEntry(entry)}
                    onPrompt={() => setPromptEntry(entry)}
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
        open={promptEntry != null}
        onOpenChange={(v) => !v && setPromptEntry(null)}
        entry={promptEntry}
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
          <div
            className={[
              "pointer-events-auto w-72 rounded-md border border-accent/40 bg-background/95 px-2 py-1 shadow-lg backdrop-blur",
              corner === "right" ? "ml-auto mr-2" : "ml-2",
            ].join(" ")}
          >
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
                      onAgentPrompt={(e) => setPromptEntry(e)}
                      size="band"
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
              <p
                className="shrink-0 max-w-[5.5rem] text-right text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground/85"
                title="Framework"
              >
                {DEV_PANEL_BRAND_MARK}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Mic: dictate additions to the update handoff for the selected target. Copies a locked prefix (route, label, source-search hints) plus your text."
                onClick={toggleUpdatePromptWithSpeech}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Copy a delete handoff prompt for the selected target (route, label, and source-search hints)."
                onClick={copyResolvedDeletePrompt}
                className="h-6 gap-1 px-1.5 text-[10px]"
              >
                {headerCopied === "delete" ? <Check size={11} /> : <Trash2 size={11} />}
                Delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={
                  promptVerbosity === "full"
                    ? "Prompts include full context. Click for compact templates."
                    : "Prompts use compact templates. Click for full context."
                }
                onClick={() => setPromptVerbosity((v) => (v === "full" ? "compact" : "full"))}
                className="h-6 px-1.5 text-[9px] font-semibold uppercase tracking-wide"
              >
                {promptVerbosity === "compact" ? "Short" : "Full"}
              </Button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="min-w-0">
                <p className="truncate">
                  <span className="text-muted-foreground">Target - </span>
                  <span className="font-medium text-foreground">
                    {sectionTarget?.label ?? bandLabel}
                  </span>
                </p>
              </div>
              <div className="ml-2 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  disabled={depthIndex <= 0}
                  onClick={() => setDepthIndex((v) => Math.max(0, v - 1))}
                >
                  <ChevronLeft size={10} />
                </Button>
                <span className="w-16 text-center">
                  d{bandCurrentDepth} - {bandVisibleEntries.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  disabled={depthIndex >= bandDepths.length - 1}
                  onClick={() => setDepthIndex((v) => Math.min(bandDepths.length - 1, v + 1))}
                >
                  <ChevronRight size={10} />
                </Button>
              </div>
            </div>
            <div className="mt-1 max-h-24 space-y-1 overflow-auto pr-1">
              {bandVisibleEntries.map((entry) => (
                <DevPanelListItem
                  key={entry.cid}
                  entry={entry}
                  active={activeTargetCid === entry.cid}
                  onSelect={() => {
                    setActiveCid(entry.cid);
                    setHighlightCid(entry.cid);
                    locate(entry.cid);
                  }}
                  onCopy={() => copyEntry(entry)}
                  onPrompt={() => setPromptEntry(entry)}
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
        </div>
      </div>
    </>
  );
}
