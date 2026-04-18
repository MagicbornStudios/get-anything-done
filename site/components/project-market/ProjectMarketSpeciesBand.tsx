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
        {/* Task 45-14: text-meta-strong sets a single tone for band titles
            so they read as section chrome, not headlines. */}
        <h2 className="text-meta-strong text-muted-foreground">
          Browse by species
        </h2>
        <span className="text-meta">
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
          // Task 45-14: chips ride on the species level token. Active state
          // saturates the species hue; idle borrows the neutral border so
          // the band doesn't compete with the project-grid below it.
          return (
            <span
              key={s.species}
              className={cn(
                "inline-flex items-stretch overflow-hidden rounded-full border text-[11px] transition-colors",
                isActive
                  ? "border-[color:color-mix(in_oklch,var(--level-species)_55%,transparent)] bg-[color:color-mix(in_oklch,var(--level-species)_18%,transparent)]"
                  : "border-border/50 hover:border-[color:color-mix(in_oklch,var(--level-species)_45%,transparent)]",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(isActive ? null : s.species)}
                title={`Filter marketplace by ${s.species}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 transition-colors",
                  isActive
                    ? "text-[color:color-mix(in_oklch,var(--level-species)_92%,white)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-mono">{s.species}</span>
                <span
                  className={cn(
                    "tabular-nums text-[10px]",
                    isActive
                      ? "text-[color:color-mix(in_oklch,var(--level-species)_75%,white)]"
                      : "text-muted-foreground/60",
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
                    ? "border-[color:color-mix(in_oklch,var(--level-species)_35%,transparent)] text-[color:color-mix(in_oklch,var(--level-species)_75%,white)] hover:text-[color:color-mix(in_oklch,var(--level-species)_95%,white)]"
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
