"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  localSearchQuery: string;
  onSearchChange: (value: string) => void;
};

export function ExperimentLogKeywordSearch({ localSearchQuery, onSearchChange }: Props) {
  return (
    <div className="relative min-w-[180px] flex-1">
      <Search
        size={13}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="text"
        value={localSearchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search rounds by keyword..."
        className="h-9 rounded-lg border-border/70 bg-background/60 py-2 pl-8 pr-8 text-xs shadow-none focus-visible:ring-accent/40"
      />
      {localSearchQuery && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onSearchChange("")}
          className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3" aria-hidden />
        </Button>
      )}
    </div>
  );
}
