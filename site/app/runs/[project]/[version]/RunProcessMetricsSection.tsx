import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

export function RunProcessMetricsSection({ run }: { run: EvalRunRecord }) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Process metrics</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          How the agent actually worked
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {run.timing && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Wall clock</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {run.timing.duration_minutes != null ? `${run.timing.duration_minutes}m` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {run.timing.phases_completed ?? 0} phases · {run.timing.tasks_completed ?? 0} tasks
              </CardContent>
            </Card>
          )}
          {run.tokenUsage && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tool uses</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {run.tokenUsage.tool_uses ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {run.tokenUsage.total_tokens != null
                  ? `${run.tokenUsage.total_tokens.toLocaleString()} tokens`
                  : ""}
                {run.tokenUsage.note ? ` · ${run.tokenUsage.note}` : ""}
              </CardContent>
            </Card>
          )}
          {run.gitAnalysis && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Commits</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {run.gitAnalysis.total_commits ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {run.gitAnalysis.task_id_commits ?? 0} with task id · {run.gitAnalysis.batch_commits ?? 0}{" "}
                batch
              </CardContent>
            </Card>
          )}
          {run.planningQuality && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Planning docs</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {run.planningQuality.decisions_captured ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                decisions captured · {run.planningQuality.phases_planned ?? 0} phases planned
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
