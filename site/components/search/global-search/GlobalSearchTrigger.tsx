"use client";

import { Search } from "lucide-react";
import { Identified } from "gad-visual-context";
import { Button } from "@/components/ui/button";

type Props = {
  onOpen: () => void;
};

export function GlobalSearchTrigger({ onOpen }: Props) {
  return (
    <Identified as="GlobalSearchTrigger">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onOpen}
        title="Search (Ctrl+K)"
        aria-label="Open search"
        className="h-auto shrink-0 gap-2 rounded-full border-border/70 bg-card/40 px-3 py-2 text-xs font-normal text-muted-foreground hover:border-accent hover:text-accent"
      >
        <Search size={13} className="size-[13px]" aria-hidden />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </Button>
    </Identified>
  );
}
