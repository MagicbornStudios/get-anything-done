"use client";

import { searchIndexSize } from "@/components/search/global-search/global-search-shared";

export function GlobalSearchFooter() {
  return (
    <div className="border-t border-border/60 bg-card/30 px-4 py-2 text-[10px] text-muted-foreground">
      <kbd className="rounded border border-border/60 bg-background/60 px-1 py-0.5 font-mono">
        ↵
      </kbd>{" "}
      to open ·{" "}
      <kbd className="rounded border border-border/60 bg-background/60 px-1 py-0.5 font-mono">
        esc
      </kbd>{" "}
      to close · {searchIndexSize()} entries indexed
    </div>
  );
}
