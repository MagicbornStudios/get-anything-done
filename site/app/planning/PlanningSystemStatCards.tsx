import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planningFmtCount, planningFmtPercent } from "./planning-system-format";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

export function PlanningSystemStatCards({ selfEval }: { selfEval: PlanningSelfEvalLatest }) {
  const runtimeDistribution = selfEval.runtime_distribution ?? [];
  const projectTokens = selfEval.project_tokens;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border/60 bg-card/40">
        <CardHeader className="pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Trace events</p>
          <CardTitle className="text-3xl tabular-nums">{planningFmtCount(selfEval.totals.events)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {planningFmtCount(selfEval.totals.sessions)} tracked sessions and{" "}
          {planningFmtCount(selfEval.totals.gad_cli_calls)} gad CLI calls
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader className="pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Runtime mix</p>
          <CardTitle className="text-3xl tabular-nums">{planningFmtCount(runtimeDistribution.length)}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          {runtimeDistribution
            .slice(0, 2)
            .map((entry) => entry.runtime)
            .join(", ") || "no runtime ids yet"}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader className="pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project token accounting</p>
          <CardTitle className="text-3xl tabular-nums">
            {planningFmtCount(projectTokens?.combined_total_tokens ?? 0)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">eval exact + live trace estimate</CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40">
        <CardHeader className="pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Loop + overhead</p>
          <CardTitle className="text-3xl tabular-nums">
            {planningFmtPercent(selfEval.loop_compliance.score)} /{" "}
            {planningFmtPercent(selfEval.framework_overhead.ratio)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">loop compliance / planning overhead</CardContent>
      </Card>
    </div>
  );
}
