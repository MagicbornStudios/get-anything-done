"use client";

/**
 * Task 44-41: species directory band on /project-market.
 *
 * Renders one chip per species that has >=1 published generation. Click toggles
 * the species filter on the marketplace. The chip set is derived from
 * MARKETPLACE_INDEX.species (built by scripts/build-site-data.mjs at predev /
 * prebuild time).
 */

import { cn } from "@/lib/utils";
import type { MarketplaceSpecies } from "@/lib/eval-data";

interface ProjectMarketSpeciesBandProps {
  species: MarketplaceSpecies[];
  active: string | null;
  onSelect: (species: string | null) => void;
}

export function ProjectMarketSpeciesBand({
  species,
  active,
  onSelect,
}: ProjectMarketSpeciesBandProps) {
  if (species.length === 0) return null;

  return (
    <section
      aria-label="Browse by species"
      className="mt-6 rounded-md border border-border/40 bg-card/30 p-3"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Browse by species
        </h2>
        <span className="text-[10px] text-muted-foreground/60">
          {species.length} published
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {active !== null && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[11px] rounded border border-border/60 px-2 py-0.5 text-muted-foreground hover:border-border hover:text-foreground transition-colors"
          >
            clear
          </button>
        )}
        {species.map((s) => {
          const isActive = active === s.species;
          return (
            <button
              key={s.species}
              type="button"
              onClick={() => onSelect(isActive ? null : s.species)}
              title={
                s.latestPublishedAt
                  ? `${s.publishedCount} generation${s.publishedCount === 1 ? "" : "s"} across ${s.projects.length} project${s.projects.length === 1 ? "" : "s"} · latest ${new Date(s.latestPublishedAt).toLocaleDateString()}`
                  : `${s.publishedCount} generation${s.publishedCount === 1 ? "" : "s"} across ${s.projects.length} project${s.projects.length === 1 ? "" : "s"}`
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                isActive
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <span className="font-mono">{s.species}</span>
              <span
                className={cn(
                  "tabular-nums text-[10px]",
                  isActive ? "text-accent/80" : "text-muted-foreground/60",
                )}
              >
                {s.publishedCount}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
