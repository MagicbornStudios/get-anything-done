"use client";

/**
 * Task 44-41: species directory band on /project-market.
 *
 * Renders one chip per species that has >=1 published generation. Click toggles
 * the species filter on the marketplace. The chip set is derived from
 * MARKETPLACE_INDEX.species (built by scripts/build-site-data.mjs at predev /
 * prebuild time).
 */

import Link from "next/link";
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
          const tooltip = s.latestPublishedAt
            ? `${s.publishedCount} generation${s.publishedCount === 1 ? "" : "s"} across ${s.projects.length} project${s.projects.length === 1 ? "" : "s"} · latest ${new Date(s.latestPublishedAt).toLocaleDateString()}`
            : `${s.publishedCount} generation${s.publishedCount === 1 ? "" : "s"} across ${s.projects.length} project${s.projects.length === 1 ? "" : "s"}`;
          return (
            <span
              key={s.species}
              className={cn(
                "inline-flex items-stretch overflow-hidden rounded-full border text-[11px] transition-colors",
                isActive
                  ? "border-accent/60 bg-accent/15"
                  : "border-border/50 hover:border-border",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(isActive ? null : s.species)}
                title={`Filter marketplace by ${s.species}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 transition-colors",
                  isActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
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
              <Link
                href={`/project-market/species/${encodeURIComponent(s.species)}`}
                title={`View species detail · ${tooltip}`}
                aria-label={`View ${s.species} species detail`}
                className={cn(
                  "inline-flex items-center border-l px-1.5 py-0.5 text-[10px] transition-colors",
                  isActive
                    ? "border-accent/40 text-accent/80 hover:text-accent"
                    : "border-border/40 text-muted-foreground/60 hover:text-foreground",
                )}
              >
                →
              </Link>
            </span>
          );
        })}
      </div>
    </section>
  );
}
