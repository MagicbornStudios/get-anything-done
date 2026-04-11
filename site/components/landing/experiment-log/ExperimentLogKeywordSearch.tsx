"use client";

import { Search, X } from "lucide-react";

type Props = {
  localSearchQuery: string;
  onSearchChange: (value: string) => void;
};

export function ExperimentLogKeywordSearch({ localSearchQuery, onSearchChange }: Props) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="text"
        value={localSearchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search rounds by keyword..."
        className="w-full rounded-lg border border-border/70 bg-background/60 py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
      />
      {localSearchQuery && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}
