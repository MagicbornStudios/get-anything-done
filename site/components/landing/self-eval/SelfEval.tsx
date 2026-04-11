"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import selfEvalData from "@/data/self-eval.json";

const data = selfEvalData.latest;

function MetricCard({
  label,
  value,
  subtext,
  score,
}: {
  label: string;
  value: string;
  subtext?: string;
  score?: number;
}) {
  const scoreColor =
    score == null
      ? ""
      : score >= 0.7
        ? "text-emerald-400"
        : score >= 0.4
          ? "text-amber-400"
          : "text-red-400";

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {subtext && <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>}
        {score != null && (
          <p className={`mt-1 text-xs font-semibold tabular-nums ${scoreColor}`}>
            Score: {score.toFixed(2)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ToolBar({ tool, count, max }: { tool: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 truncate text-xs text-muted-foreground">{tool}</span>
      <div className="flex-1 h-2 rounded-full bg-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent/60"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

export default function SelfEval() {
  if (!data) return null;

  const topTools = data.tool_distribution.filter((t) => t.tool !== "unknown").slice(0, 8);
  const maxToolCount = topTools.length > 0 ? topTools[0].count : 1;

  return (
    <section id="self-eval" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Framework usage</p>
        <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Real data from building GAD <span className="gradient-text">with GAD.</span>
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
          We use GAD to build GAD. These metrics come from our actual trace logs —
          {data.totals.events.toLocaleString()} tool calls across {data.totals.sessions} sessions
          over {data.period.days} days. Not a controlled experiment, just real work.
        </p>

        {/* Key metrics grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Framework overhead"
            value={`${(data.framework_overhead.ratio * 100).toFixed(1)}%`}
            subtext={`${data.framework_overhead.planning_ops} planning ops / ${data.framework_overhead.planning_ops + data.framework_overhead.source_ops} total`}
            score={data.framework_overhead.score}
          />
          <MetricCard
            label="Loop compliance"
            value={`${(data.loop_compliance.score * 100).toFixed(0)}%`}
            subtext={`${data.loop_compliance.snapshot_starts} of ${data.loop_compliance.total_sessions} sessions start with snapshot`}
            score={data.loop_compliance.score}
          />
          <MetricCard
            label="Tasks"
            value={`${data.tasks.done} / ${data.tasks.total}`}
            subtext={`${data.tasks.planned} planned · ${data.tasks.in_progress} in progress`}
          />
          <MetricCard
            label="Decisions"
            value={String(data.decisions)}
            subtext="Captured in DECISIONS.xml"
          />
        </div>

        {/* Tool distribution + GAD CLI breakdown */}
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tool distribution
            </h3>
            <div className="mt-4 space-y-2.5">
              {topTools.map((t) => (
                <ToolBar key={t.tool} tool={t.tool} count={t.count} max={maxToolCount} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              GAD CLI usage
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-center">
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {data.gad_cli_breakdown.snapshot}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">snapshots</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-center">
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {data.gad_cli_breakdown.eval}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">eval commands</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-center">
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {data.gad_cli_breakdown.other}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">other CLI</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Period
              </h3>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">{data.period.start}</Badge>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge variant="outline">{data.period.end}</Badge>
                <Badge variant="default">{data.period.days} days</Badge>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Computed at {new Date(data.computed_at).toLocaleString()}. Source: .planning/.gad-log/ trace data.
        </p>
      </div>
    </section>
  );
}
