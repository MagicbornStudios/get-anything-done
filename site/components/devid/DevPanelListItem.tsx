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
  mergeSelected,
  onRowClick,
  onCopy,
  onPrompt,
}: {
  dockCorner: VcPanelCorner;
  entry: RegistryEntry;
  active: boolean;
  /** In merge group at this depth but not the primary focused row. */
  mergeSelected?: boolean;
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
          : mergeSelected
            ? "border-violet-500/50 bg-violet-500/10 text-foreground"
            : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground",
      )}
    >
      <DevChromeHoverHint
        dockCorner={dockCorner}
        body={
          <p>
            {entry.label} — <span className="font-mono">{entry.cid}</span>. Click to select and locate. Ctrl or ⌘+click
            toggles this row in a same-depth merge group for one agent handoff.
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
            Open the agent handoff dialog. If several rows are merged at this depth, the prompt lists every target.
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
