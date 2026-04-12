import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCount } from "./planning-system-format";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

type PlanningSystemProjectTokensPanelProps = {
  selfEval: PlanningSelfEvalLatest;
  topProjectTokenSource: number;
};

export function PlanningSystemProjectTokensPanel({
  selfEval,
  topProjectTokenSource,
}: PlanningSystemProjectTokensPanelProps) {
  const projectTokens = selfEval.project_tokens;

  return (
    <Card className="border-border/60 bg-card/40">
      <CardHeader>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project token accounting</p>
        <CardTitle className="text-base">Exact eval totals plus estimated live framework I/O</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Combined total</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {planningFmtCount(projectTokens?.combined_total_tokens)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">best available full-project number</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Exact eval tokens</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {planningFmtCount(projectTokens?.exact_eval_tokens)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">from preserved TRACE.json files</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated live input</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {planningFmtCount(projectTokens?.estimated_live_input_tokens)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">serialized trace-event inputs / 4</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated live output</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {planningFmtCount(projectTokens?.estimated_live_output_tokens)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">serialized trace-event outputs / 4</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-xs text-muted-foreground">
          Live framework tokens are an estimate from repo trace events, not billing data. They are still useful
          for trend tracking and relative comparison across our own framework work.
        </div>

        <div className="space-y-2.5">
          {(projectTokens?.sources ?? []).length > 0 ? (
            (projectTokens?.sources ?? []).map((source) => (
              <PlanningSystemBarRow
                key={source.path}
                label={source.path}
                value={source.estimated_total_tokens}
                max={topProjectTokenSource}
                suffix="tok"
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No repo trace-event sources found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
