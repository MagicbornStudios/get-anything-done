import { Identified } from "@portfolio/visual-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

type GitAnalysis = NonNullable<EvalRunRecord["gitAnalysis"]>;

export function RunProcessMetricsCommitsCard({ gitAnalysis }: { gitAnalysis: GitAnalysis }) {
  return (
    <Identified as="RunProcessMetricsCommitsCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Commits</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{gitAnalysis.total_commits ?? 0}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {gitAnalysis.task_id_commits ?? 0} with task id · {gitAnalysis.batch_commits ?? 0} batch
        </CardContent>
      </Card>
    </Identified>
  );
}
