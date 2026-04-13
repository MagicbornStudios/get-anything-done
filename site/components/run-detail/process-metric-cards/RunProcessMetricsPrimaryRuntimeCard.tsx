import { Identified } from "@/components/devid/Identified";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";
import { runtimeLabel } from "@/lib/run-process-metrics-runtime-label";

export function RunProcessMetricsPrimaryRuntimeCard({ run }: { run: EvalRunRecord }) {
  const runtimesInvolved = (run.runtimesInvolved ?? []).filter(Boolean);
  return (
    <Identified as="RunProcessMetricsPrimaryRuntimeCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Primary runtime</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{runtimeLabel(run.runtimeIdentity)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {runtimesInvolved.length > 0
            ? `${runtimesInvolved.length} runtime record(s) preserved`
            : "older runs may not carry runtime attribution yet"}
        </CardContent>
      </Card>
    </Identified>
  );
}
