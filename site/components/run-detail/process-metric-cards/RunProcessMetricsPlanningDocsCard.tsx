import { Identified } from "@portfolio/visual-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

type PlanningQuality = NonNullable<EvalRunRecord["planningQuality"]>;

export function RunProcessMetricsPlanningDocsCard({
  planningQuality,
}: {
  planningQuality: PlanningQuality;
}) {
  return (
    <Identified as="RunProcessMetricsPlanningDocsCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Planning docs</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{planningQuality.decisions_captured ?? 0}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          decisions captured · {planningQuality.phases_planned ?? 0} phases planned
        </CardContent>
      </Card>
    </Identified>
  );
}
