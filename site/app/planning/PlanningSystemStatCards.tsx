import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planningFmtCount, planningFmtPercent } from "./planning-system-format";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

export function PlanningSystemStatCards({ selfEval }: { selfEval: PlanningSelfEvalLatest }) {
  const projectTokens = selfEval.project_tokens;
  const planningOverhead = selfEval.framework_overhead.ratio;

  const planTone =
    planningOverhead <= 0.12
      ? "text-emerald-400"
      : planningOverhead <= 0.22
        ? "text-amber-400"
        : "text-rose-400";
  const planBar =
    planningOverhead <= 0.12
      ? "from-emerald-500/90 to-emerald-700/90"
      : planningOverhead <= 0.22
        ? "from-amber-400/90 to-amber-700/90"
        : "from-rose-400/90 to-rose-700/90";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="space-y-2 pb-2 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Planning overhead
            </p>
            <CardTitle className={`text-3xl tabular-nums tracking-tight ${planTone}`}>
              {planningFmtPercent(planningOverhead)}
            </CardTitle>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Planning-file ops share of CLI file activity - framework tax on the loop
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40" title="Lower is better">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-[width] ${planBar}`}
                style={{ width: `${Math.min(100, planningOverhead * 100)}%` }}
              />
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/40">
        <CardHeader className="pb-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project token accounting</p>
          <CardTitle className="text-2xl tabular-nums">
            {planningFmtCount(projectTokens?.combined_total_tokens ?? 0)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          eval exact + live trace estimate
        </CardContent>
      </Card>
    </div>
  );
}
