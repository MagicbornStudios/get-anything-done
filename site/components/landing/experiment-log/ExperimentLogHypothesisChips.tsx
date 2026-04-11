"use client";

import { HYPOTHESES } from "@/components/landing/experiment-log/experiment-log-shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  localHypothesisFilter: string | null;
  onHypothesisChange: (value: string | null) => void;
};

export function ExperimentLogHypothesisChips({ localHypothesisFilter, onHypothesisChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onHypothesisChange(null)}
        className={cn(
          "h-auto rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-none",
          !localHypothesisFilter
            ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
            : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
        )}
      >
        All hypotheses
      </Button>
      {HYPOTHESES.map((h) => {
        const active = localHypothesisFilter === h.id;
        return (
          <Button
            key={h.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onHypothesisChange(active ? null : h.id)}
            className={cn(
              "h-auto rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-none",
              active
                ? "border-accent bg-accent/20 text-accent hover:bg-accent/25"
                : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
            )}
          >
            {h.label}
          </Button>
        );
      })}
    </div>
  );
}
