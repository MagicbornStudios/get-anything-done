"use client";

import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-wrap gap-1.5">
      {projects.map((p) => (
        <Badge
          key={p}
          variant="outline"
          className="border-border/50 bg-card/60 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground"
        >
          {p.replace("escape-the-dungeon", "etd")}
        </Badge>
      ))}
      {workflows.map((w) => (
        <Badge
          key={w}
          variant="default"
          className="border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-accent"
        >
          {w}
        </Badge>
      ))}
      <Badge
        variant="outline"
        className="border-border/50 bg-card/60 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground"
      >
        {roundRuns.length} run{roundRuns.length !== 1 ? "s" : ""}
      </Badge>
    </div>
  );
}
