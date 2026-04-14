"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Mic,
  MicOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry, type RegistryEntry } from "./SectionRegistry";
import { Identified } from "./Identified";
import {
  buildDeletePrompt,
  buildUpdateLockedPrefix,
  DevIdAgentPromptDialog,
} from "./DevIdAgentPromptDialog";
import { DEV_PANEL_LABEL, DEV_PANEL_STABLE_CID } from "./dev-panel-constants";
import { absolutePageUrl } from "./absolutePageUrl";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import { DevPanelPositionControls } from "./DevPanelPositionControls";
import { DevPanelListItem } from "./DevPanelListItem";
import { Button } from "@/components/ui/button";

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

function sortRegistryEntries(entries: RegistryEntry[]): RegistryEntry[] {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.depth !== b.entry.depth) return a.entry.depth - b.entry.depth;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

function escapeCidSelector(cid: string) {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(cid)
    : cid.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function queryByCid(cid: string) {
  return document.querySelector(`[data-cid="${escapeCidSelector(cid)}"]`) as HTMLElement | null;
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

function readEntryFromElement(
  node: HTMLElement,
  depth: number,
  fallback?: Partial<RegistryEntry>,
): RegistryEntry | null {
  const cid = node.getAttribute("data-cid") ?? fallback?.cid ?? "";
  if (!cid) return null;
  return {
    cid,
    label: node.getAttribute("data-cid-label") ?? fallback?.label ?? cid,
    depth,
    componentTag:
      (node.getAttribute("data-cid-component-tag") as RegistryEntry["componentTag"] | null) ??
      fallback?.componentTag,
    searchHint: node.getAttribute("data-cid-search") ?? fallback?.searchHint,
  };
}

function collectScopedEntries(
  scope: HTMLElement | null,
  options?: {
    includeScope?: boolean;
    fallbackRoot?: Partial<RegistryEntry>;
  },
): RegistryEntry[] {
  if (!scope) {
    return options?.fallbackRoot?.cid
      ? [
          {
            cid: options.fallbackRoot.cid,
            label: options.fallbackRoot.label ?? options.fallbackRoot.cid,
            depth: 0,
            componentTag: options.fallbackRoot.componentTag,
            searchHint: options.fallbackRoot.searchHint,
          },
        ]
      : [];
  }
  const nodes = [
    ...(options?.includeScope ? [scope] : []),
    ...Array.from(scope.querySelectorAll<HTMLElement>("[data-cid]")),
  ];
  const withDepth = nodes
    .map((node) => {
      let depth = 0;
      let current: HTMLElement | null = node === scope ? null : node.parentElement;
      while (current) {
        if (scope.contains(current) && current.hasAttribute("data-cid")) depth += 1;
        if (current === scope) break;
        current = current.parentElement;
      }
      return readEntryFromElement(
        node,
        depth,
        node === scope ? options?.fallbackRoot : undefined,
      );
    })
    .filter((entry): entry is RegistryEntry => entry != null);
  const minDepth = withDepth.length > 0 ? Math.min(...withDepth.map((e) => e.depth)) : 0;
  const dedup = new Map<string, RegistryEntry>();
  for (const entry of withDepth) {
    if (!entry.cid || dedup.has(entry.cid)) continue;
    dedup.set(entry.cid, { ...entry, depth: Math.max(0, entry.depth - minDepth) });
  }
  return Array.from(dedup.values());
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
  const { enabled, setHighlightCid, flashComponent } = useDevId();
  const registry = useSectionRegistry();
  const panelRef = useRef<HTMLDivElement | null>(null);

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
    const scope = queryByCid(bandCid);
    setBandEntries(
      collectScopedEntries(scope, {
        includeScope: true,
        fallbackRoot: {
          cid: bandCid,
          label: bandLabel,
          depth: 0,
          componentTag: bandComponentTag,
          searchHint: bandSearchHint,
        },
      }),
    );
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

  const panelIdDisplay =
    mode === "section"
      ? mountedSectionEntry?.cid ?? sectionTarget?.cid ?? DEV_PANEL_STABLE_CID
      : sectionTarget?.cid ?? bandEntries[0]?.cid ?? bandCid;
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

  const copyResolvedDeletePrompt = () => {
    if (!sectionTarget) return;
    const resolved = buildDeletePrompt(
      absolutePageUrl(pathname),
      sectionTarget.label,
      sectionTarget.cid,
      sectionTarget.componentTag ?? "Identified",
      sectionTarget.searchHint,
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
            "group-hover/site-section:pointer-events-auto group-hover/site-section:opacity-100",
            "group-focus-within/site-section:pointer-events-auto group-focus-within/site-section:opacity-100",
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
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <div className="min-w-0">
                  <p className="font-semibold uppercase tracking-wide text-accent">Dev Panel</p>
                  <p className="truncate text-muted-foreground">
                    Section scan
                    {" "}
                    {sectionEntries.length}
                    {" "}
                    items
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-muted-foreground" title={panelIdDisplay}>
                    {panelIdDisplay}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyValue(panelIdDisplay)}
                    className="size-6"
                  >
                    <Copy size={11} />
                  </Button>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
                  onClick={copyResolvedDeletePrompt}
                  disabled={!sectionTarget}
                  className="h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide"
                >
                  {headerCopied === "delete" ? <Check size={12} /> : <Trash2 size={12} />}
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => sectionTarget && copyEntry(sectionTarget)}
                  className="size-6"
                >
                  <Copy size={11} />
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
                  <p className="truncate font-mono">
                    {sectionTarget?.searchHint ?? sectionTarget?.cid ?? "No target selected"}
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
              {listening && interim ? (
                <p className="mt-1 max-w-56 truncate text-[10px] text-emerald-300">
                  <span className="font-semibold">Live - </span>
                  {interim}
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
          "pointer-events-none sticky z-[80] w-full opacity-0 transition-opacity duration-200",
          edge === "top" ? "top-2" : "bottom-2",
          "group-hover/site-band:pointer-events-auto group-hover/site-band:opacity-100",
          "group-focus-within/site-band:pointer-events-auto group-focus-within/site-band:opacity-100",
        ].join(" ")}
      >
        <div
          className={[
            "pointer-events-auto w-72 rounded-md border border-accent/40 bg-background/95 px-2 py-1 shadow-lg backdrop-blur",
            corner === "right" ? "ml-auto mr-2" : "ml-2",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <div className="min-w-0">
              <p className="font-semibold uppercase tracking-wide text-accent">Dev Panel</p>
              <p className="truncate text-muted-foreground">
                {bandLabel} - {bandEntries.length} items
              </p>
            </div>
            <span className="truncate font-mono text-muted-foreground" title={panelIdDisplay}>
              {panelIdDisplay}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              onClick={copyResolvedDeletePrompt}
              className="h-6 gap-1 px-1.5 text-[10px]"
            >
              {headerCopied === "delete" ? <Check size={11} /> : <Trash2 size={11} />}
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copyValue(panelIdDisplay)}
              className="size-6"
            >
              <Copy size={11} />
            </Button>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="min-w-0">
              <p className="truncate">
                <span className="text-muted-foreground">Target - </span>
                <span className="font-medium text-foreground">{sectionTarget?.label ?? bandLabel}</span>
              </p>
              <p className="truncate font-mono">
                {sectionTarget?.searchHint ?? sectionTarget?.cid ?? panelIdDisplay}
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
              <span className="w-16 text-center">d{bandCurrentDepth} - {bandVisibleEntries.length}</span>
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
          {listening && interim ? (
            <p className="mt-1 max-w-56 truncate text-[10px] text-emerald-300">
              <span className="font-semibold">Live - </span>
              {interim}
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
    </>
  );
}
