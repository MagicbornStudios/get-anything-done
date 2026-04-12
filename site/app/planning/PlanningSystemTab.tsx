import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCount, planningFmtPercent } from "./planning-system-format";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

export type { PlanningSelfEvalLatest } from "./planning-system-types";

export function PlanningSystemTab({ selfEval }: { selfEval: PlanningSelfEvalLatest }) {
  const runtimeDistribution = selfEval.runtime_distribution ?? [];
  const runtimeSessions = selfEval.runtime_sessions ?? [];
  const evals = selfEval.evals;
  const projectTokens = selfEval.project_tokens;
  const topRuntimeCount = runtimeDistribution[0]?.count ?? 1;
  const topEvalRuntimeCount = evals?.runtime_distribution?.[0]?.count ?? 1;
  const topPressure = [...selfEval.phases_pressure]
    .sort((a, b) => b.pressure_score - a.pressure_score)
    .slice(0, 8);
  const topProjects = (evals?.project_breakdown ?? []).slice(0, 8);
  const topProjectTokenSource = projectTokens?.sources?.[0]?.estimated_total_tokens ?? 1;

  return (
    <div className="space-y-6">
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
            {runtimeDistribution.slice(0, 2).map((entry) => entry.runtime).join(", ") || "no runtime ids yet"}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project token accounting</p>
            <CardTitle className="text-3xl tabular-nums">
              {planningFmtCount(projectTokens?.combined_total_tokens ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            eval exact + live trace estimate
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Loop + overhead</p>
            <CardTitle className="text-3xl tabular-nums">
              {planningFmtPercent(selfEval.loop_compliance.score)} /{" "}
              {planningFmtPercent(selfEval.framework_overhead.ratio)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            loop compliance / planning overhead
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
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
                <p className="mt-1 text-xs text-muted-foreground">serialized trace-event inputs ÷ 4</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated live output</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {planningFmtCount(projectTokens?.estimated_live_output_tokens)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">serialized trace-event outputs ÷ 4</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-xs text-muted-foreground">
              Live framework tokens are an estimate from repo trace events, not billing data. They are still useful for trend tracking and relative comparison across our own framework work.
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

        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Monorepo runtime activity</p>
            <CardTitle className="text-base">What the root `.gad-log` is seeing right now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2.5">
              {runtimeDistribution.length > 0 ? (
                runtimeDistribution.map((entry) => (
                  <PlanningSystemBarRow
                    key={`events-${entry.runtime}`}
                    label={entry.runtime}
                    value={entry.count ?? 0}
                    max={topRuntimeCount}
                    suffix="events"
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No runtime-attributed events captured yet.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {runtimeSessions.map((entry) => (
                <Badge key={`sessions-${entry.runtime}`} variant="outline">
                  {entry.runtime}: {planningFmtCount(entry.sessions)} sessions
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              This is pseudo real-time operational telemetry from the monorepo `.planning/.gad-log/`. It measures active system usage, not just preserved eval runs.
            </p>
          </CardContent>
        </Card>

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
                (evals?.runtime_distribution ?? []).map((entry) => (
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
              Eval token totals are reliable because they come from preserved `TRACE.json`. Full project-wide input/output token accounting outside evals is not first-class yet.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pressure hotspots</p>
            <CardTitle className="text-base">Where the framework is accumulating complexity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPressure.map((phase) => (
              <div
                key={phase.phase}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-3"
              >
                <Ref id={phase.phase} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">
                    Pressure {phase.pressure_score} • {phase.tasks_done}/{phase.tasks_total} tasks done •{" "}
                    {phase.crosscuts} crosscuts
                  </p>
                </div>
                {phase.high_pressure && <Badge variant="outline">candidate</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Token-heavy eval projects</p>
            <CardTitle className="text-base">Where most preserved eval spend is landing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProjects.length > 0 ? (
              topProjects.map((project) => (
                <div key={project.project} className="rounded-xl border border-border/50 bg-background/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{project.project}</p>
                    <Badge variant="outline">{planningFmtCount(project.runs)} runs</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {planningFmtCount(project.total_tokens)} tracked tokens • {planningFmtCount(project.total_tool_uses)}{" "}
                    tool uses • {planningFmtCount(project.reviewed_runs)} reviewed
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No eval traces found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
