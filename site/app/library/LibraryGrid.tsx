"use client";

import { useMemo, useState } from "react";
import type { PlayableEntry } from "./scan-published";
import { LibraryCard } from "./LibraryCard";

interface LibraryGridProps {
  entries: PlayableEntry[];
  domains: string[];
}

export function LibraryGrid({ entries, domains }: LibraryGridProps) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = entries;
    if (activeDomain) {
      result = result.filter((e) => e.domain === activeDomain);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.project.toLowerCase().includes(q) ||
          e.species.toLowerCase().includes(q) ||
          (e.name && e.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, activeDomain, search]);

  const filterTabs = [
    { label: "All", value: null },
    ...domains.map((d) => ({ label: d.charAt(0).toUpperCase() + d.slice(1), value: d })),
  ];

  return (
    <div data-cid="library-grid">
      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border/50 bg-card/40 p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveDomain(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeDomain === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-card/80 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search project or species..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-56 rounded-md border border-border/50 bg-card/40 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No published builds match the current filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((entry) => (
            <LibraryCard
              key={`${entry.project}/${entry.species}/${entry.version}`}
              entry={entry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
