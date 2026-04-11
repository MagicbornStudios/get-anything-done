import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  total: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onSelectIndex: (index: number) => void;
};

export function RoundsPagination({
  total,
  currentIndex,
  onPrev,
  onNext,
  onSelectIndex,
}: Props) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentIndex === 0}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-border/70 disabled:hover:text-muted-foreground"
      >
        <ChevronLeft size={12} aria-hidden />
        Prev
      </button>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectIndex(i)}
            className={[
              "size-8 rounded-full text-xs font-semibold transition-colors",
              i === currentIndex
                ? "border border-accent bg-accent text-accent-foreground"
                : "border border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
            ].join(" ")}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex === total - 1}
        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-border/70 disabled:hover:text-muted-foreground"
      >
        Next
        <ChevronRight size={12} aria-hidden />
      </button>
      <span className="text-xs text-muted-foreground">
        {currentIndex + 1} of {total}
      </span>
    </div>
  );
}
