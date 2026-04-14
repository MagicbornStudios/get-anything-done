"use client";

/**
 * SectionDevPanel — section-local slide-in panel listing registered `<Identified>`
 * bands (sorted by registry depth). No HoverCard/Tooltip on rows — Radix poppers
 * inside the transformed slide-in repeatedly hit “maximum update depth” in dev.
 */

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Settings2, Copy, Eye, X, MessageSquare } from "lucide-react";
import { useDevId } from "./DevIdProvider";
import { useSectionRegistry, type RegistryEntry } from "./SectionRegistry";
import { Identified } from "./Identified";
import { DevIdAgentPromptDialog } from "./DevIdAgentPromptDialog";
import { cn } from "@/lib/utils";
import { DEV_PANEL_LABEL, DEV_PANEL_STABLE_CID } from "./dev-panel-constants";

function sortRegistryEntries(entries: RegistryEntry[]): RegistryEntry[] {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.depth !== b.entry.depth) return a.entry.depth - b.entry.depth;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

type RowProps = {
  entry: RegistryEntry;
  highlightCid: string | null;
  setHighlightCid: (v: string | null) => void;
  justCopied: string | null;
  onCopy: (cid: string) => void;
  onPrompt: (entry: RegistryEntry) => void;
};

function RegistryListRow({
  entry,
  highlightCid,
  setHighlightCid,
  justCopied,
  onCopy,
  onPrompt,
}: RowProps) {
  const isHl = highlightCid === entry.cid;
  return (
    <li
      className={cn(
        "group/cid flex items-center gap-1 rounded-md px-1 py-1 text-[11px] transition-colors",
        isHl ? "bg-accent/15" : "hover:bg-card/60",
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setHighlightCid(isHl ? null : entry.cid);
        }}
        className="shrink-0 text-muted-foreground hover:text-accent"
        aria-label="Toggle persistent highlight"
        title="Toggle persistent highlight"
      >
        <Eye size={12} />
      </button>

      <button
        type="button"
        onClick={() => onCopy(entry.cid)}
        className={cn(
          "min-w-0 flex-1 cursor-pointer select-none truncate rounded px-1 py-0.5 text-left transition-colors",
          "hover:bg-background/40",
        )}
        title={`${entry.label} · depth ${entry.depth} · click to copy ${entry.cid}`}
      >
        <span className="text-muted-foreground/80">{entry.label}</span>
        <span className="ml-1.5 font-mono text-accent">{entry.cid}</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPrompt(entry);
        }}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover/cid:opacity-100"
        aria-label="Open agent prompt handoff"
        title="Agent handoff (update / delete)"
      >
        <MessageSquare size={12} />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(entry.cid);
        }}
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover/cid:opacity-100"
        aria-label="Copy ID"
        title="Copy ID"
      >
        <Copy size={12} />
      </button>
      {justCopied === entry.cid && (
        <span className="shrink-0 text-[9px] uppercase tracking-wider text-emerald-400">copied</span>
      )}
    </li>
  );
}

export function SectionDevPanel() {
  const pathname = usePathname() ?? "";
  const { enabled, highlightCid, setHighlightCid } = useDevId();
  const registry = useSectionRegistry();
  const [open, setOpen] = useState(false);
  const [justCopied, setJustCopied] = useState<string | null>(null);
  const [promptEntry, setPromptEntry] = useState<RegistryEntry | null>(null);

  if (!enabled || !registry) return null;

  const sortedEntries = sortRegistryEntries(registry.entries);

  const copy = (cid: string) => {
    navigator.clipboard?.writeText(cid).catch(() => {});
    setJustCopied(cid);
    setTimeout(() => setJustCopied(null), 900);
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute right-3 top-3 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent/40 bg-background/80 text-accent opacity-40 backdrop-blur transition-opacity hover:opacity-100"
        aria-label="Toggle Dev Panel"
      >
        <Settings2 size={14} />
      </button>

      <div
        className={[
          "pointer-events-none absolute right-0 top-0 z-40 h-full w-80 max-w-[85%]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
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
                <button
                  type="button"
                  onClick={() => copy(DEV_PANEL_STABLE_CID)}
                  className="text-accent underline decoration-dotted underline-offset-2 hover:text-accent/90"
                  title="Copy panel data-cid"
                >
                  {DEV_PANEL_STABLE_CID}
                </button>
                <span className="text-muted-foreground">
                  {" "}
                  · {sortedEntries.length} listed · depth ≤ {registry.maxDepth}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-visible p-2">
            {sortedEntries.length === 0 ? (
              <li className="px-2 py-3 text-[11px] text-muted-foreground">
                No registered blocks in this section. Add{" "}
                <code className="rounded bg-card px-1 font-mono text-[10px]">sectionBandCid</code> on{" "}
                <code className="rounded bg-card px-1 font-mono text-[10px]">SiteSection</code> and/or{" "}
                <code className="rounded bg-card px-1 font-mono text-[10px]">&lt;Identified&gt;</code> bands (inner
                chrome may use{" "}
                <code className="rounded bg-card px-1 font-mono text-[10px]">register=&#123;false&#125;</code>).
              </li>
            ) : (
              sortedEntries.map((entry) => (
                <RegistryListRow
                  key={entry.cid}
                  entry={entry}
                  highlightCid={highlightCid}
                  setHighlightCid={setHighlightCid}
                  justCopied={justCopied}
                  onCopy={copy}
                  onPrompt={setPromptEntry}
                />
              ))
            )}
          </ul>

          <div className="shrink-0 border-t border-border/60 p-3 text-[10px] leading-4 text-muted-foreground">
            <kbd className="rounded bg-card px-1 font-mono">Alt+I</kbd> toggles dev IDs. Row label click copies id (see
            native tooltip on hover). <kbd className="rounded bg-card px-1 font-mono">Alt</kbd>
            -click a highlighted component copies id. Message icon: handoff prompts for your agent.
          </div>
        </Identified>
      </div>
    </>
  );
}
