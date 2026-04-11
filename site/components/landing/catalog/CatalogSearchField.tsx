"use client";

import { Search } from "lucide-react";
import { TAB_META, type CatalogTab } from "@/components/landing/catalog/catalog-shared";

type Props = {
  tab: CatalogTab;
  query: string;
  onQueryChange: (query: string) => void;
};

export function CatalogSearchField({ tab, query, onQueryChange }: Props) {
  return (
    <div className="relative flex-1 min-w-52 max-w-md">
      <Search
        size={14}
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="text"
        placeholder={`Filter ${TAB_META[tab].label.toLowerCase()}…`}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="w-full rounded-full border border-border/70 bg-card/40 py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent/60 focus:outline-none"
      />
    </div>
  );
}
