"use client";

import { HYPOTHESES } from "@/components/landing/experiment-log/experiment-log-shared";

type Props = {
  localHypothesisFilter: string | null;
  onHypothesisChange: (value: string | null) => void;
};

export function ExperimentLogHypothesisChips({ localHypothesisFilter, onHypothesisChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onHypothesisChange(null)}
        className={[
          "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
          !localHypothesisFilter
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
        ].join(" ")}
      >
        All hypotheses
      </button>
      {HYPOTHESES.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onHypothesisChange(localHypothesisFilter === h.id ? null : h.id)}
          className={[
            "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
            localHypothesisFilter === h.id
              ? "border-accent bg-accent/20 text-accent"
              : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
          ].join(" ")}
        >
          {h.label}
        </button>
      ))}
    </div>
  );
}
