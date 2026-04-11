"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={effectiveIndex === 0}
        className="h-auto gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        <ChevronLeft size={12} aria-hidden />
        Prev
      </Button>
      <span className="text-xs text-muted-foreground">
        {effectiveIndex + 1} of {filteredLength}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={effectiveIndex === filteredLength - 1}
        className="h-auto gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        Next
        <ChevronRight size={12} aria-hidden />
      </Button>
    </div>
  );
}
