"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Mic, MicOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry, type RegistryEntry } from "./SectionRegistry";
import { Identified } from "./Identified";
import {
  buildDeletePrompt,
  buildUpdateLockedPrefix,
  DevIdAgentPromptDialog,
  type HandoffComponentTag,
} from "./DevIdAgentPromptDialog";
import { DEV_PANEL_LABEL, DEV_PANEL_STABLE_CID } from "./dev-panel-constants";
import { absolutePageUrl } from "./absolutePageUrl";
import { SectionRegistryListRow } from "./SectionRegistryListRow";
import { useDictatedPromptCopy } from "./useDictatedPromptCopy";
import { Button } from "@/components/ui/button";

function sortRegistryEntries(entries: RegistryEntry[]): RegistryEntry[] {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.depth !== b.entry.depth) return a.entry.depth - b.entry.depth;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

function locateComponentOnPage(cid: string, flashComponent: (cid: string) => void) {
  const safe =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(cid)
      : cid.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const el = document.querySelector(`[data-cid="${safe}"]`) as HTMLElement | null;
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

export function SectionDevPanel() {
  const pathname = usePathname() ?? "";
  const { enabled, highlightCid, setHighlightCid, flashComponent } = useDevId();
  const registry = useSectionRegistry();
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const [promptEntry, setPromptEntry] = useState<RegistryEntry | null>(null);
  const [headerCopied, setHeaderCopied] = useState<"update" | "delete" | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mountedSectionCid, setMountedSectionCid] = useState<string | null>(null);

  const locate = useCallback(
    (cid: string) => {
      locateComponentOnPage(cid, flashComponent);
    },
    [flashComponent],
  );

  if (!enabled || !registry) return null;

  const sortedEntries = sortRegistryEntries(registry.entries);

  useEffect(() => {
    const host = panelRef.current;
    const section = host?.closest("section[data-cid]") as HTMLElement | null;
    setMountedSectionCid(section?.getAttribute("data-cid") ?? null);
  }, [sortedEntries.length, pathname]);

  const hasMountedSectionEntry = mountedSectionCid
    ? sortedEntries.some((entry) => entry.cid === mountedSectionCid)
    : false;

  const displayEntries =
    mountedSectionCid && !hasMountedSectionEntry
      ? [{ cid: mountedSectionCid, label: "CurrentSectionBand", depth: 0 }, ...sortedEntries]
      : sortedEntries;

  const sectionTarget = displayEntries.find((entry) => entry.depth === 0) ?? displayEntries[0] ?? null;
  const panelIdDisplay = mountedSectionCid ?? sectionTarget?.cid ?? DEV_PANEL_STABLE_CID;
  const componentTag: HandoffComponentTag = "Identified";

  const finalizeUpdatePromptCopy = (transcript: string) => {
    if (!sectionTarget) return;
    const prefix = buildUpdateLockedPrefix(
      absolutePageUrl(pathname),
      sectionTarget.label,
      sectionTarget.cid,
      componentTag,
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
      componentTag,
    );
    navigator.clipboard?.writeText(resolved).catch(() => {});
    setHeaderCopied("delete");
    window.setTimeout(() => setHeaderCopied(null), 1200);
    toast.success("Delete prompt copied");
  };

  const copy = (cid: string) => {
    navigator.clipboard?.writeText(cid).catch(() => {});
    setJustCopied(cid);
    window.setTimeout(() => setJustCopied(null), 900);
  };

  return (
    <>
      <DevIdAgentPromptDialog
        open={promptEntry != null}
        onOpenChange={(v) => {
          if (!v) setPromptEntry(null);
        }}
        entry={promptEntry}
        pathname={pathname}
      />

      <div
        ref={panelRef}
        className={[
          "pointer-events-none absolute right-0 top-0 z-40 h-full w-80 max-w-[85%] opacity-0",
          "transition-opacity duration-200 ease-out",
          "group-hover/site-section:pointer-events-auto group-hover/site-section:opacity-100",
          "group-focus-within/site-section:pointer-events-auto group-focus-within/site-section:opacity-100",
        ].join(" ")}
        aria-hidden={!enabled}
      >
        <Identified
          as={DEV_PANEL_LABEL}
          stableCid={DEV_PANEL_STABLE_CID}
          register={false}
          className="pointer-events-auto flex min-h-0 flex-col overflow-x-visible border-l border-accent/40 bg-background/95 shadow-2xl backdrop-blur"
          depth={0}
        >
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Dev Panel</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Blocks in this section</p>
              <p className="mt-1 truncate text-[10px] font-mono text-muted-foreground/90">
                <span className="text-muted-foreground">Panel id · </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(panelIdDisplay)}
                  className="h-auto p-0 text-accent underline decoration-dotted underline-offset-2 hover:text-accent/90"
                  title="Copy panel data-cid"
                >
                  {panelIdDisplay}
                </Button>
                <span className="text-muted-foreground">
                  {" "}
                  · {displayEntries.length} listed · depth ≤ {registry.maxDepth}
                </span>
              </p>
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleUpdatePromptWithSpeech}
                disabled={!sectionTarget}
                className="h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide"
                title={listening ? "Stop dictation and copy resolved update prompt" : "Start dictation for update prompt"}
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
                title="Copy resolved delete prompt"
              >
                {headerCopied === "delete" ? <Check size={12} /> : <Trash2 size={12} />}
                Delete
              </Button>
            </div>
          </div>

          {listening && interim ? (
            <div className="border-b border-border/60 bg-emerald-500/10 px-4 py-1.5 text-[10px] text-emerald-300">
              <span className="font-semibold">Live · </span>
              <span className="line-clamp-2">{interim}</span>
            </div>
          ) : null}

          <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-visible p-2">
            {displayEntries.length === 0 ? (
              <li className="px-2 py-3 text-[11px] text-muted-foreground">
                No registered blocks in this section.{" "}
                <code className="rounded bg-card px-1 font-mono text-[10px]">SiteSection</code> auto-registers its
                section band id; add{" "}
                <code className="rounded bg-card px-1 font-mono text-[10px]">&lt;Identified&gt;</code> bands for inner
                landmarks (inner chrome may use{" "}
                <code className="rounded bg-card px-1 font-mono text-[10px]">register=&#123;false&#125;</code>).
              </li>
            ) : (
              displayEntries.map((entry) => (
                <SectionRegistryListRow
                  key={entry.cid}
                  entry={entry}
                  highlightCid={highlightCid}
                  setHighlightCid={setHighlightCid}
                  justCopied={justCopied}
                  onCopy={copy}
                  onLocate={locate}
                  onPrompt={setPromptEntry}
                />
              ))
            )}
          </ul>

          <div className="shrink-0 border-t border-border/60 p-3 text-[10px] leading-4 text-muted-foreground">
            <kbd className="rounded bg-card px-1 font-mono">Alt+I</kbd> toggles dev IDs. Row label: scroll to block +
            flash highlight. Copy icon copies id. <kbd className="rounded bg-card px-1 font-mono">Alt</kbd>-click a
            component copies id. Message: agent handoff.
          </div>
        </Identified>
      </div>
    </>
  );
}
