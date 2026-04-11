"use client";

import { useMemo, useState } from "react";
import {
  filterCatalogItems,
  sourceItemsForTab,
  type CatalogItem,
  type CatalogTab,
} from "@/components/landing/catalog/catalog-shared";

export function useCatalogSection() {
  const [tab, setTab] = useState<CatalogTab>("skills");
  const [query, setQuery] = useState("");

  const items: CatalogItem[] = useMemo(() => {
    const source = sourceItemsForTab(tab);
    return filterCatalogItems(source, query);
  }, [tab, query]);

  return { tab, setTab, query, setQuery, items };
}
