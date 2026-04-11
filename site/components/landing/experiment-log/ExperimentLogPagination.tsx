"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  effectiveIndex: number;
  filteredLength: number;
  onPrev: () => void;
  onNext: () => void;
};

export function ExperimentLogPagination({
  effectiveIndex,
  filteredLength,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={effectiveIndex === 0}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-border/70 disabled:hover:text-muted-foreground"
      >
        <ChevronLeft size={12} aria-hidden />
        Prev
      </button>
      <span className="text-xs text-muted-foreground">
        {effectiveIndex + 1} of {filteredLength}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={effectiveIndex === filteredLength - 1}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-border/70 disabled:hover:text-muted-foreground"
      >
        Next
        <ChevronRight size={12} aria-hidden />
      </button>
    </div>
  );
}
