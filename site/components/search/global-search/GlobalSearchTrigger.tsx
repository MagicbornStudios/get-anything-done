"use client";

import { Search } from "lucide-react";

type Props = {
  onOpen: () => void;
};

export function GlobalSearchTrigger({ onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Search (Ctrl+K)"
      aria-label="Open search"
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/40 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
    >
      <Search size={13} aria-hidden />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
        Ctrl K
      </kbd>
    </button>
  );
}
