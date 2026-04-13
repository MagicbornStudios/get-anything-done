"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReviewState } from "@/lib/filter-store";
import {
  REVIEW_STATE_DOT,
  REVIEW_STATE_LABEL,
  STATUS_CHIP_STYLES,
} from "@/components/landing/playable/playable-shared";

const STATUSES = ["all", "reviewed", "needs-review", "excluded"] as const;

export type EvalReviewStatusFilterChipsProps = {
  statusFilter: "all" | ReviewState;
  onStatusChange: (value: "all" | ReviewState) => void;
  className?: string;
};

/**
 * Review-state chip row shared by playable archive and project market filter bars.
 */
export function EvalReviewStatusFilterChips({
  statusFilter,
  onStatusChange,
  className,
}: EvalReviewStatusFilterChipsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {STATUSES.map((s) => {
        const isActive = statusFilter === s;
        const styles = STATUS_CHIP_STYLES[s];
        return (
          <Button
            key={s}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onStatusChange(s)}
            className={cn(
              "h-auto gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-none",
              isActive ? styles.active : styles.base,
            )}
          >
            {s !== "all" ? (
              <span className={`size-1.5 rounded-full ${REVIEW_STATE_DOT[s]}`} aria-hidden />
            ) : null}
            {s === "all" ? "All statuses" : REVIEW_STATE_LABEL[s]}
          </Button>
        );
      })}
    </div>
  );
}
