"use client";

import type { EvalRunRecord } from "@/lib/eval-data";
import { PlayableReviewLegend } from "@/components/landing/playable/PlayableReviewLegend";
import { PlayableRunGroups, type PlayableRunGroup } from "@/components/landing/playable/PlayableRunGroups";

type Props = {
  groupedRuns: PlayableRunGroup[];
  selected: EvalRunRecord | null;
  onSelectRun: (key: string) => void;
};

export function ProjectMarketPlayableCatalog({ groupedRuns, selected, onSelectRun }: Props) {
  return (
    <>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Playable builds
      </h2>
      <p className="mb-6 text-xs text-muted-foreground">
        Click any build badge to play it in-browser. Hover for details.
      </p>
      <PlayableReviewLegend />
      <PlayableRunGroups groupedRuns={groupedRuns} selected={selected} onSelectRun={onSelectRun} />
    </>
  );
}
