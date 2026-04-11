"use client";

import type { RoundSummary } from "@/lib/eval-data";
import { ALL_ROUNDS } from "@/components/landing/experiment-log/experiment-log-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          <Button
            key={round}
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              const idx = filteredSummaries.findIndex((s) => s.round === round);
              if (idx >= 0) onSelectRound(idx);
            }}
            disabled={!isInFiltered}
            className={cn(
              "size-8 rounded-full p-0 text-xs font-semibold shadow-none",
              isActive
                ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                : isInFiltered
                  ? "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
                  : "border-border/40 bg-card/20 text-muted-foreground/30"
            )}
          >
            {i + 1}
          </Button>
        );
      })}
    </div>
  );
}
