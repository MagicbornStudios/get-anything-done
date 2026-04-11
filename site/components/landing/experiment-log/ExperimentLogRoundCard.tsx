"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { RoundSummary } from "@/lib/eval-data";
import { ROUND_TINT } from "@/components/landing/experiment-log/experiment-log-shared";
import { ExperimentLogBody } from "@/components/landing/experiment-log/ExperimentLogBody";
import { ExperimentLogRoundTags } from "@/components/landing/experiment-log/ExperimentLogRoundTags";
import { cn } from "@/lib/utils";

type Props = {
  round: RoundSummary;
};

export function ExperimentLogRoundCard({ round }: Props) {
  return (
    <Card
      className={cn(
        "mt-4 border-l-4 bg-card/40 shadow-none",
        ROUND_TINT[round.round] ?? "border-l-border"
      )}
    >
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 pb-2">
        <Badge variant="default">{round.round}</Badge>
        <h3 className="text-xl font-semibold tracking-tight text-foreground">{round.title}</h3>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <ExperimentLogRoundTags roundLabel={round.round} />
        <ExperimentLogBody body={round.body} />
      </CardContent>
    </Card>
  );
}
