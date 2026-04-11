"use client";

import { SKILL_INHERITANCE } from "@/lib/catalog.generated";
import { CatalogItemLink } from "@/components/landing/catalog/CatalogItemLink";
import type { CatalogItem, CatalogTab } from "@/components/landing/catalog/catalog-shared";

type Props = {
  items: CatalogItem[];
  tab: CatalogTab;
};

export function CatalogGrid({ items, tab }: Props) {
  return (
    <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const inherited = tab === "skills" ? (SKILL_INHERITANCE[item.id] ?? []) : [];
        return (
          <CatalogItemLink key={item.id} item={item} tab={tab} inherited={inherited} />
        );
      })}
    </div>
  );
}
