"use client";

import type { RoundSummary } from "@/lib/eval-data";
import { ALL_ROUNDS } from "@/components/landing/experiment-log/experiment-log-shared";

type Props = {
  filteredSummaries: RoundSummary[];
  activeRound: string | undefined;
  onSelectRound: (index: number) => void;
};

export function ExperimentLogRoundPills({ filteredSummaries, activeRound, onSelectRound }: Props) {
  return (
    <div className="flex gap-1.5">
      {ALL_ROUNDS.map((round, i) => {
        const isInFiltered = filteredSummaries.some((s) => s.round === round);
        const isActive = activeRound === round;
        return (
          <button
            key={round}
            type="button"
            onClick={() => {
              const idx = filteredSummaries.findIndex((s) => s.round === round);
              if (idx >= 0) onSelectRound(idx);
            }}
            disabled={!isInFiltered}
            className={[
              "size-8 rounded-full text-xs font-semibold transition-colors",
              isActive
                ? "border border-accent bg-accent text-accent-foreground"
                : isInFiltered
                  ? "border border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
                  : "border border-border/40 bg-card/20 text-muted-foreground/30",
            ].join(" ")}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
