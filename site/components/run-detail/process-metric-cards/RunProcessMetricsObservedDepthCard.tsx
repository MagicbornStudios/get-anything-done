import { Identified } from "gad-visual-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

type Lineage = NonNullable<EvalRunRecord["agentLineage"]>;

export function RunProcessMetricsObservedDepthCard({ lineage }: { lineage: Lineage }) {
  return (
    <Identified as="RunProcessMetricsObservedDepthCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Observed depth</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {lineage.max_depth_observed != null ? lineage.max_depth_observed : "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {lineage.events_with_agent} traced event(s) with agent lineage
        </CardContent>
      </Card>
    </Identified>
  );
}
