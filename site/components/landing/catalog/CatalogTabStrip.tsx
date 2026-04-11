"use client";

import { CATALOG_TABS, type CatalogTab } from "@/components/landing/catalog/catalog-shared";
import { CatalogTabButton } from "@/components/landing/catalog/CatalogTabButton";

type Props = {
  tab: CatalogTab;
  onTabChange: (tab: CatalogTab) => void;
};

export function CatalogTabStrip({ tab, onTabChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/40 p-1">
      {CATALOG_TABS.map((key) => (
        <CatalogTabButton
          key={key}
          tabKey={key}
          active={key === tab}
          onSelect={() => onTabChange(key)}
        />
      ))}
    </div>
  );
}
