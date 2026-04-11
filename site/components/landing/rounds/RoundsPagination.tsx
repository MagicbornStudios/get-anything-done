"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={currentIndex === 0}
        className="h-auto gap-1 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
      >
        <ChevronLeft size={12} aria-hidden />
        Prev
      </Button>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <Button
            key={i}
            type="button"
            variant="outline"
            onClick={() => onSelectIndex(i)}
            className={cn(
              "size-8 shrink-0 rounded-full p-0 text-xs font-semibold shadow-none",
              i === currentIndex
                ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
            )}
          >
            {i + 1}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={currentIndex === total - 1}
        className="h-auto gap-1 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
      >
        Next
        <ChevronRight size={12} aria-hidden />
      </Button>
      <span className="text-xs text-muted-foreground">
        {currentIndex + 1} of {total}
      </span>
    </div>
  );
}
