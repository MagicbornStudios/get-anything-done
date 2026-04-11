"use client";

import { CatalogEmptyState } from "@/components/landing/catalog/CatalogEmptyState";
import { CatalogGrid } from "@/components/landing/catalog/CatalogGrid";
import { CatalogIntro } from "@/components/landing/catalog/CatalogIntro";
import { CatalogToolbar } from "@/components/landing/catalog/CatalogToolbar";
import { useCatalogSection } from "@/components/landing/catalog/use-catalog-section";

export default function Catalog() {
  const { tab, setTab, query, setQuery, items } = useCatalogSection();

  return (
    <section id="catalog" className="border-t border-border/60">
      <div className="section-shell">
        <CatalogIntro />

        <CatalogToolbar tab={tab} query={query} onTabChange={setTab} onQueryChange={setQuery} />

        <CatalogGrid items={items} tab={tab} />

        {items.length === 0 && <CatalogEmptyState query={query} />}
      </div>
    </section>
  );
}
