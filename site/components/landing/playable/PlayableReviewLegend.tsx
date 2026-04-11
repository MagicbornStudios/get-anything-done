"use client";

import { REVIEW_STATE_DOT } from "@/components/landing/playable/playable-shared";

export function PlayableReviewLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      <span className="font-semibold uppercase tracking-wider">Legend:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${REVIEW_STATE_DOT.reviewed}`} aria-hidden />
        reviewed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${REVIEW_STATE_DOT["needs-review"]}`} aria-hidden />
        needs review
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${REVIEW_STATE_DOT.excluded}`} aria-hidden />
        excluded (rate-limited / api-interrupted)
      </span>
    </div>
  );
}
