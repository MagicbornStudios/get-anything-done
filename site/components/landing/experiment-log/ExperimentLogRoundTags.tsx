"use client";

import { EVAL_RUNS } from "@/lib/eval-data";
import { roundForRun } from "@/components/landing/hypothesis-tracks/hypothesis-tracks-shared";

type Props = {
  roundLabel: string;
};

export function ExperimentLogRoundTags({ roundLabel }: Props) {
  const roundRuns = EVAL_RUNS.filter((run) => roundForRun(run) === roundLabel);
  const projects = [...new Set(roundRuns.map((run) => run.project))];
  const workflows = [...new Set(roundRuns.map((run) => run.workflow))];

  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {projects.map((p) => (
        <span
          key={p}
          className="rounded-full border border-border/50 bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {p.replace("escape-the-dungeon", "etd")}
        </span>
      ))}
      {workflows.map((w) => (
        <span
          key={w}
          className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
        >
          {w}
        </span>
      ))}
      <span className="rounded-full border border-border/50 bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {roundRuns.length} run{roundRuns.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
