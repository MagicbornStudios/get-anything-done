"use client";

import { Copy, Eye, MessageSquare } from "lucide-react";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import { cn } from "@/lib/utils";
import type { RegistryEntry } from "./SectionRegistry";

type SectionRegistryListRowProps = {
  entry: RegistryEntry;
  highlightCid: string | null;
  setHighlightCid: (v: string | null) => void;
  justCopied: string | null;
  onCopy: (cid: string) => void;
  onLocate: (cid: string) => void;
  onPrompt: (entry: RegistryEntry) => void;
};

export function SectionRegistryListRow({
  entry,
  highlightCid,
  setHighlightCid,
  justCopied,
  onCopy,
  onLocate,
  onPrompt,
}: SectionRegistryListRowProps) {
  const isHl = highlightCid === entry.cid;

  return (
    <li
      className={cn(
        "group/cid flex items-center gap-1 rounded-md px-1 py-1 text-[11px] transition-colors",
        isHl ? "bg-accent/15" : "hover:bg-card/60",
      )}
    >
      <DevChromeHoverHint body={<p>Toggle persistent highlight for this landmark (Alt+click on page does the same).</p>}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setHighlightCid(isHl ? null : entry.cid);
          }}
          className="shrink-0 text-muted-foreground hover:text-accent"
          aria-label="Toggle persistent highlight"
        >
          <Eye size={12} />
        </button>
      </DevChromeHoverHint>

      <DevChromeHoverHint
        body={
          <p>
            {entry.label} · depth {entry.depth}. Click to scroll to the component and flash the highlight.
          </p>
        }
      >
        <button
          type="button"
          onClick={() => onLocate(entry.cid)}
          className={cn(
            "min-w-0 flex-1 cursor-pointer select-none truncate rounded px-1 py-0.5 text-left transition-colors",
            "hover:bg-background/40",
          )}
          aria-label={`Scroll to ${entry.label} on the page`}
        >
          <span className="text-muted-foreground/80">{entry.label}</span>
          <span className="ml-1.5 font-mono text-accent">{entry.cid}</span>
        </button>
      </DevChromeHoverHint>

      <DevChromeHoverHint body={<p>Open the agent handoff dialog (update / delete prompts).</p>}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrompt(entry);
          }}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover/cid:opacity-100"
          aria-label="Open agent prompt handoff"
        >
          <MessageSquare size={12} />
        </button>
      </DevChromeHoverHint>

      <DevChromeHoverHint body={<p>Copy this landmark’s id / search token.</p>}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(entry.cid);
          }}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover/cid:opacity-100"
          aria-label="Copy ID"
        >
          <Copy size={12} />
        </button>
      </DevChromeHoverHint>
      {justCopied === entry.cid && (
        <span className="shrink-0 text-[9px] uppercase tracking-wider text-emerald-400">copied</span>
      )}
    </li>
  );
}
