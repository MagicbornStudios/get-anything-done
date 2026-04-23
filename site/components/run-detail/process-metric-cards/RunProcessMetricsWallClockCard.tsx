import { Identified } from "@portfolio/visual-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

type Timing = NonNullable<EvalRunRecord["timing"]>;

export function RunProcessMetricsWallClockCard({ timing }: { timing: Timing }) {
  return (
    <Identified as="RunProcessMetricsWallClockCard" className="contents">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Wall clock</CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {timing.duration_minutes != null ? `${timing.duration_minutes}m` : "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {timing.phases_completed ?? 0} phases · {timing.tasks_completed ?? 0} tasks
        </CardContent>
      </Card>
    </Identified>
  );
}
