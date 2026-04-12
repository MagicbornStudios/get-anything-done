import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCount } from "./planning-system-format";
import type { PlanningRuntimeCount, PlanningSelfEvalLatest } from "./planning-system-types";

type PlanningSystemEvalTelemetryPanelProps = {
  selfEval: PlanningSelfEvalLatest;
  topEvalRuntimeCount: number;
};

export function PlanningSystemEvalTelemetryPanel({
  selfEval,
  topEvalRuntimeCount,
}: PlanningSystemEvalTelemetryPanelProps) {
  const evals = selfEval.evals;

  return (
    <Card className="border-border/60 bg-card/40">
      <CardHeader>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Eval telemetry</p>
        <CardTitle className="text-base">What preserved `TRACE.json` already measures well</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Eval runs</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{planningFmtCount(evals?.runs ?? 0)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {planningFmtCount(evals?.projects ?? 0)} projects • {planningFmtCount(evals?.reviewed_runs ?? 0)}{" "}
              reviewed
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tool uses</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{planningFmtCount(evals?.tool_uses.total ?? 0)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {planningFmtCount(evals?.tool_uses.tracked_runs ?? 0)} runs reported tool-use counts
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg tokens / tracked run</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {planningFmtCount(evals?.tokens.avg_per_tracked_run)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Missing token data for {planningFmtCount(evals?.tokens.missing_runs ?? 0)} run(s)
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Latest eval date</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{evals?.latest_run_date ?? "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Preserved run artifacts only</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {(evals?.runtime_distribution ?? []).length > 0 ? (
            (evals?.runtime_distribution ?? []).map((entry: PlanningRuntimeCount) => (
              <PlanningSystemBarRow
                key={`eval-runtime-${entry.runtime}`}
                label={entry.runtime}
                value={entry.count ?? 0}
                max={topEvalRuntimeCount}
                suffix="runs"
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              Runtime attribution is present in the schema, but older runs have not all been backfilled yet.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Eval token totals are reliable because they come from preserved `TRACE.json`. Full project-wide
          input/output token accounting outside evals is not first-class yet.
        </p>
      </CardContent>
    </Card>
  );
}
