"use client";

import type { MouseEvent } from "react";
import { Copy, MessageSquare } from "lucide-react";
import { DevChromeHoverHint, type VcPanelCorner } from "@/components/devid/DevChromeHoverHint";
import type { RegistryEntry } from "./SectionRegistry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DevPanelListItem({
  dockCorner,
  entry,
  active,
  altMergeSelected,
  ctrlLaneSelected,
  onRowClick,
  onCopy,
  onPrompt,
}: {
  dockCorner: VcPanelCorner;
  entry: RegistryEntry;
  active: boolean;
  /** Alt-lane: in same-depth merge group but not the primary focused row. */
  altMergeSelected?: boolean;
  /** Ctrl/Cmd-lane: cross-depth reference selection. */
  ctrlLaneSelected?: boolean;
  onRowClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onCopy: () => void;
  onPrompt: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded border p-0.5",
        active
          ? "border-accent/60 bg-accent/10 text-accent"
          : ctrlLaneSelected && altMergeSelected
            ? "border-violet-500/50 bg-violet-500/10 text-foreground ring-1 ring-inset ring-sky-400/55"
            : ctrlLaneSelected
              ? "border-sky-500/55 bg-sky-500/10 text-foreground"
              : altMergeSelected
                ? "border-violet-500/50 bg-violet-500/10 text-foreground"
                : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground",
      )}
    >
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={
          <p>
            {entry.label} — <span className="font-mono">{entry.cid}</span>. Click: single Alt-lane target (clears Ctrl
            lane) and locate. Alt+click: toggle this row in the same-depth Alt merge group. Ctrl or ⌘+click: toggle the
            cross-depth Ctrl reference lane (independent of Alt).
          </p>
        }
      >
        <button type="button" onClick={onRowClick} className="min-w-0 flex-1 rounded px-1 py-0.5 text-left">
          <span className="block truncate text-[10px]">{entry.label}</span>
          <span className="block truncate text-[10px] font-mono text-muted-foreground">{entry.cid}</span>
        </button>
      </DevChromeHoverHint>
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={<p>Copy the source-search token for this row (cid / stableCid / as — greppable in repo).</p>}
      >
        <Button type="button" variant="ghost" size="icon" className="size-5" onClick={onCopy}>
          <Copy size={10} />
        </Button>
      </DevChromeHoverHint>
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={
          <p>
            Open the agent handoff dialog. Alt-lane merges list every merged target; active Ctrl-lane picks append as an
            extra reference block when present.
          </p>
        }
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5"
          aria-label="Open Agent handoff dialog"
          onClick={onPrompt}
        >
          <MessageSquare size={10} />
        </Button>
      </DevChromeHoverHint>
    </div>
  );
}
