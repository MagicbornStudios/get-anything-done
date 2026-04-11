"use client";

import { Search } from "lucide-react";
import { TAB_META, type CatalogTab } from "@/components/landing/catalog/catalog-shared";
import { Input } from "@/components/ui/input";

type Props = {
  tab: CatalogTab;
  query: string;
  onQueryChange: (query: string) => void;
};

export function CatalogSearchField({ tab, query, onQueryChange }: Props) {
  return (
    <div className="relative min-w-52 max-w-md flex-1">
      <Search
        size={14}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        placeholder={`Filter ${TAB_META[tab].label.toLowerCase()}…`}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="rounded-full border-border/70 bg-card/40 py-2.5 pl-9 pr-4 text-sm shadow-none focus-visible:border-accent/60"
      />
    </div>
  );
}
