"use client";

import { CatalogSearchField } from "@/components/landing/catalog/CatalogSearchField";
import { CatalogTabStrip } from "@/components/landing/catalog/CatalogTabStrip";
import type { CatalogTab } from "@/components/landing/catalog/catalog-shared";

type Props = {
  tab: CatalogTab;
  query: string;
  onTabChange: (tab: CatalogTab) => void;
  onQueryChange: (query: string) => void;
};

export function CatalogToolbar({ tab, query, onTabChange, onQueryChange }: Props) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3">
      <CatalogTabStrip tab={tab} onTabChange={onTabChange} />
      <CatalogSearchField tab={tab} query={query} onQueryChange={onQueryChange} />
    </div>
  );
}
