"use client";

type Props = {
  roundFilter: string | null;
  onClearAllFilters: () => void;
};

export function PlayableNoResults({ roundFilter, onClearAllFilters }: Props) {
  return (
    <div className="mt-8 rounded-2xl border border-border/70 bg-card/30 p-8 text-center">
      <p className="text-lg font-semibold text-muted-foreground">
        No playable builds match your filters
      </p>
      <p className="mt-2 text-sm text-muted-foreground/70">
        {roundFilter && `${roundFilter} may not have scored builds yet, or all runs were rate-limited. `}
        Try adjusting your filters or search query.
      </p>
      <button
        type="button"
        onClick={onClearAllFilters}
        className="mt-4 inline-flex items-center gap-1 rounded-full border border-accent/60 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
      >
        Clear all filters
      </button>
    </div>
  );
}
