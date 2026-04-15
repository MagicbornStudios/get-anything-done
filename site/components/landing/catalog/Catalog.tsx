"use client";

import { CatalogEmptyState } from "@/components/landing/catalog/CatalogEmptyState";
import { CatalogGrid } from "@/components/landing/catalog/CatalogGrid";
import { CatalogIntro } from "@/components/landing/catalog/CatalogIntro";
import { CatalogToolbar } from "@/components/landing/catalog/CatalogToolbar";
import { useCatalogSection } from "@/components/landing/catalog/use-catalog-section";
import { SiteSection } from "@/components/site";

export default function Catalog() {
  const { tab, setTab, query, setQuery, items } = useCatalogSection();

  return (
    <SiteSection id="catalog" cid="catalog-site-section" className="border-t border-border/60">
      <CatalogIntro />

      <CatalogToolbar tab={tab} query={query} onTabChange={setTab} onQueryChange={setQuery} />

      <CatalogGrid items={items} tab={tab} />

      {items.length === 0 && <CatalogEmptyState query={query} />}
    </SiteSection>
  );
}

