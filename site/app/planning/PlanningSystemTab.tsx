import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";

type RuntimeCount = {
  runtime: string;
  count?: number;
  sessions?: number;
};

type PhasePressure = {
  phase: string;
  tasks_total: number;
  tasks_done: number;
  crosscuts: number;
  pressure_score: number;
  high_pressure: boolean;
};

type EvalProjectBreakdown = {
  project: string;
  runs: number;
  reviewed_runs: number;
  total_tokens: number;
  tracked_token_runs: number;
  total_tool_uses: number;
  latest_version?: string;
};

type SelfEvalLatest = {
  totals: {
    events: number;
    sessions: number;
    gad_cli_calls: number;
  };
  runtime_distribution?: RuntimeCount[];
  runtime_sessions?: RuntimeCount[];
  framework_overhead: {
    ratio: number;
  };
  loop_compliance: {
    score: number;
  };
  phases_pressure: PhasePressure[];
  evals?: {
    runs: number;
    projects: number;
    reviewed_runs: number;
    latest_run_date: string | null;
    tokens: {
      total: number;
      tracked_runs: number;
      missing_runs: number;
      avg_per_tracked_run: number | null;
    };
    tool_uses: {
      total: number;
      tracked_runs: number;
    };
    runtime_distribution: RuntimeCount[];
    project_breakdown: EvalProjectBreakdown[];
  };
  project_tokens?: {
    exact_eval_tokens: number;
    estimated_live_input_tokens: number;
    estimated_live_output_tokens: number;
    estimated_live_total_tokens: number;
    combined_total_tokens: number;
    trace_files: number;
    trace_events: number;
    runtime_distribution: RuntimeCount[];
    sources: Array<{
      path: string;
      events: number;
      estimated_input_tokens: number;
      estimated_output_tokens: number;
      estimated_total_tokens: number;
    }>;
  };
};

function fmtCount(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString();
}

function fmtPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function BarRow({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 truncate text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/40">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-xs tabular-nums text-foreground">
        {fmtCount(value)}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );
}

export function PlanningSystemTab({ selfEval }: { selfEval: SelfEvalLatest }) {
  const runtimeDistribution = selfEval.runtime_distribution ?? [];
  const runtimeSessions = selfEval.runtime_sessions ?? [];
  const evals = selfEval.evals;
  const projectTokens = selfEval.project_tokens;
  const topRuntimeCount = runtimeDistribution[0]?.count ?? 1;
  const topEvalRuntimeCount = evals?.runtime_distribution?.[0]?.count ?? 1;
  const topPressure = [...selfEval.phases_pressure].sort((a, b) => b.pressure_score - a.pressure_score).slice(0, 8);
  const topProjects = (evals?.project_breakdown ?? []).slice(0, 8);
  const topProjectTokenSource = projectTokens?.sources?.[0]?.estimated_total_tokens ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Trace events</p>
            <CardTitle className="text-3xl tabular-nums">{fmtCount(selfEval.totals.events)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {fmtCount(selfEval.totals.sessions)} tracked sessions and {fmtCount(selfEval.totals.gad_cli_calls)} gad CLI calls
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Runtime mix</p>
            <CardTitle className="text-3xl tabular-nums">{fmtCount(runtimeDistribution.length)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {runtimeDistribution.slice(0, 2).map((entry) => entry.runtime).join(", ") || "no runtime ids yet"}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project token accounting</p>
            <CardTitle className="text-3xl tabular-nums">
              {fmtCount(projectTokens?.combined_total_tokens ?? 0)}
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
              {fmtPercent(selfEval.loop_compliance.score)} / {fmtPercent(selfEval.framework_overhead.ratio)}
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
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCount(projectTokens?.combined_total_tokens)}</p>
                <p className="mt-1 text-xs text-muted-foreground">best available full-project number</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Exact eval tokens</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCount(projectTokens?.exact_eval_tokens)}</p>
                <p className="mt-1 text-xs text-muted-foreground">from preserved TRACE.json files</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated live input</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCount(projectTokens?.estimated_live_input_tokens)}</p>
                <p className="mt-1 text-xs text-muted-foreground">serialized trace-event inputs ÷ 4</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated live output</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCount(projectTokens?.estimated_live_output_tokens)}</p>
                <p className="mt-1 text-xs text-muted-foreground">serialized trace-event outputs ÷ 4</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/30 p-4 text-xs text-muted-foreground">
              Live framework tokens are an estimate from repo trace events, not billing data. They are still useful for trend tracking and relative comparison across our own framework work.
            </div>

            <div className="space-y-2.5">
              {(projectTokens?.sources ?? []).length > 0 ? (projectTokens?.sources ?? []).map((source) => (
                <BarRow
                  key={source.path}
                  label={source.path}
                  value={source.estimated_total_tokens}
                  max={topProjectTokenSource}
                  suffix="tok"
                />
              )) : (
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
              {runtimeDistribution.length > 0 ? runtimeDistribution.map((entry) => (
                <BarRow key={`events-${entry.runtime}`} label={entry.runtime} value={entry.count ?? 0} max={topRuntimeCount} suffix="events" />
              )) : <p className="text-xs text-muted-foreground">No runtime-attributed events captured yet.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {runtimeSessions.map((entry) => (
                <Badge key={`sessions-${entry.runtime}`} variant="outline">
                  {entry.runtime}: {fmtCount(entry.sessions)} sessions
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
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCount(evals?.runs ?? 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtCount(evals?.projects ?? 0)} projects • {fmtCount(evals?.reviewed_runs ?? 0)} reviewed</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tool uses</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCount(evals?.tool_uses.total ?? 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmtCount(evals?.tool_uses.tracked_runs ?? 0)} runs reported tool-use counts</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg tokens / tracked run</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtCount(evals?.tokens.avg_per_tracked_run)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Missing token data for {fmtCount(evals?.tokens.missing_runs ?? 0)} run(s)</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Latest eval date</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{evals?.latest_run_date ?? "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Preserved run artifacts only</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {(evals?.runtime_distribution ?? []).length > 0 ? (evals?.runtime_distribution ?? []).map((entry) => (
                <BarRow key={`eval-runtime-${entry.runtime}`} label={entry.runtime} value={entry.count ?? 0} max={topEvalRuntimeCount} suffix="runs" />
              )) : <p className="text-xs text-muted-foreground">Runtime attribution is present in the schema, but older runs have not all been backfilled yet.</p>}
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
              <div key={phase.phase} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-3">
                <Ref id={phase.phase} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">
                    Pressure {phase.pressure_score} • {phase.tasks_done}/{phase.tasks_total} tasks done • {phase.crosscuts} crosscuts
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
            {topProjects.length > 0 ? topProjects.map((project) => (
              <div key={project.project} className="rounded-xl border border-border/50 bg-background/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{project.project}</p>
                  <Badge variant="outline">{fmtCount(project.runs)} runs</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fmtCount(project.total_tokens)} tracked tokens • {fmtCount(project.total_tool_uses)} tool uses • {fmtCount(project.reviewed_runs)} reviewed
                </p>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground">No eval traces found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
