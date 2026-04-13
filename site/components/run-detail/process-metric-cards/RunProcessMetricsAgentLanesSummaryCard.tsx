import { Identified } from "@/components/devid/Identified";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

type Lineage = NonNullable<EvalRunRecord["agentLineage"]>;

export function RunProcessMetricsAgentLanesSummaryCard({ lineage }: { lineage: Lineage }) {
  return (
    <Identified as="RunProcessMetricsAgentLanesSummaryCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Agent lanes</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{lineage.total_agents}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {lineage.root_agent_count} root · {lineage.subagent_count} subagent · source {lineage.source}
        </CardContent>
      </Card>
    </Identified>
  );
}
