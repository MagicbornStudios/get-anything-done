"use client";

import { Filter, X } from "lucide-react";

type Props = {
  filteredCount: number;
  total: number;
  globalRoundFilter: string | null;
  hasActiveFilters: boolean;
  onClearLocalFilters: () => void;
};

export function ExperimentLogFilterSummary({
  filteredCount,
  total,
  globalRoundFilter,
  hasActiveFilters,
  onClearLocalFilters,
}: Props) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground tabular-nums">{filteredCount}</span>{" "}
        of <span className="font-semibold text-foreground tabular-nums">{total}</span>{" "}
        round{total !== 1 ? "s" : ""}
        {globalRoundFilter && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
            <Filter size={9} aria-hidden />
            {globalRoundFilter} (from chart)
          </span>
        )}
      </p>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearLocalFilters}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground underline decoration-dotted hover:text-foreground"
        >
          <X size={10} aria-hidden />
          Clear filters
        </button>
      )}
    </div>
  );
}
