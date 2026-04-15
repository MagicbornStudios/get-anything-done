"use client";

import { Copy, MessageSquare } from "lucide-react";
import { DevChromeHoverHint } from "@/components/devid/DevChromeHoverHint";
import type { RegistryEntry } from "./SectionRegistry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DevPanelListItem({
  entry,
  active,
  onSelect,
  onCopy,
  onPrompt,
}: {
  entry: RegistryEntry;
  active: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onPrompt: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded border p-0.5",
        active
          ? "border-accent/60 bg-accent/10 text-accent"
          : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground",
      )}
    >
      <DevChromeHoverHint
        body={
          <p>
            {entry.label} — <span className="font-mono">{entry.cid}</span>. Click the row to select, locate on page, and
            sync highlight.
          </p>
        }
      >
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 rounded px-1 py-0.5 text-left">
          <span className="block truncate text-[10px]">{entry.label}</span>
          <span className="block truncate text-[10px] font-mono text-muted-foreground">{entry.cid}</span>
        </button>
      </DevChromeHoverHint>
      <DevChromeHoverHint
        body={<p>Copy the source-search token for this row (cid / stableCid / as — greppable in repo).</p>}
      >
        <Button type="button" variant="ghost" size="icon" className="size-5" onClick={onCopy}>
          <Copy size={10} />
        </Button>
      </DevChromeHoverHint>
      <DevChromeHoverHint body={<p>Open the agent handoff dialog for this landmark.</p>}>
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
