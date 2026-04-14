"use client";

import { Copy, MessageSquare } from "lucide-react";
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
      title={`${entry.label} (${entry.cid})`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 rounded px-1 py-0.5 text-left"
      >
        <span className="block truncate text-[10px]">{entry.label}</span>
        <span className="block truncate text-[10px] font-mono text-muted-foreground">{entry.cid}</span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-5" onClick={onCopy}>
        <Copy size={10} />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-5" onClick={onPrompt}>
        <MessageSquare size={10} />
      </Button>
    </div>
  );
}
