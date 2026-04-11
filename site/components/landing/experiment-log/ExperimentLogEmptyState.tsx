"use client";

type Props = {
  onClearLocalFilters: () => void;
};

export function ExperimentLogEmptyState({ onClearLocalFilters }: Props) {
  return (
    <div className="mt-8 rounded-2xl border border-border/70 bg-card/30 p-8 text-center">
      <p className="text-lg font-semibold text-muted-foreground">
        No rounds match your filters
      </p>
      <p className="mt-2 text-sm text-muted-foreground/70">
        Try adjusting your project, hypothesis, or search filters.
      </p>
      <button
        type="button"
        onClick={onClearLocalFilters}
        className="mt-4 inline-flex items-center gap-1 rounded-full border border-accent/60 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
      >
        Clear all filters
      </button>
    </div>
  );
}
