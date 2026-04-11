"use client";

import { Badge } from "@/components/ui/badge";
import type { RoundSummary } from "@/lib/eval-data";
import { ROUND_TINT } from "@/components/landing/experiment-log/experiment-log-shared";
import { ExperimentLogBody } from "@/components/landing/experiment-log/ExperimentLogBody";
import { ExperimentLogRoundTags } from "@/components/landing/experiment-log/ExperimentLogRoundTags";

type Props = {
  round: RoundSummary;
};

export function ExperimentLogRoundCard({ round }: Props) {
  return (
    <div className="mt-4">
      <article
        className={`rounded-2xl border border-l-4 bg-card/40 p-6 md:p-8 ${ROUND_TINT[round.round] ?? "border-l-border"}`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="default">{round.round}</Badge>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{round.title}</h3>
        </div>

        <ExperimentLogRoundTags roundLabel={round.round} />

        <ExperimentLogBody body={round.body} />
      </article>
    </div>
  );
}
