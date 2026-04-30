"use client";

import { Badge } from "@/components/ui/badge";
import selfEvalData from "@/data/self-eval.json";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Identified } from "gad-visual-context";
import { SelfEvalMetricCard } from "./SelfEvalMetricCard";
import { SelfEvalToolBar } from "./SelfEvalToolBar";

const data = selfEvalData.latest;

export default function SelfEval() {
  if (!data) return null;

  const topTools = data.tool_distribution.filter((t) => t.tool !== "unknown").slice(0, 8);
  const maxToolCount = topTools.length > 0 ? topTools[0].count : 1;

  return (
    <SiteSection id="self-eval" cid="self-eval-site-section" tone="muted" className="border-t border-border/60">
      <SiteSectionHeading
        kicker="Framework usage"
        preset="hero-compact"
        title={
          <>
            Real data from building GAD <span className="gradient-text">with GAD.</span>
          </>
        }
      />
      <SiteProse className="mt-5">
        We use GAD to build GAD. These metrics come from our actual trace logs â€”
        {data.totals.events.toLocaleString()} tool calls across {data.totals.sessions} sessions over{" "}
        {data.period.days} days. Not a controlled experiment, just real work.
      </SiteProse>

      <Identified as="SelfEval.MetricGrid" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Identified as="MetricCard.Overhead">
          <SelfEvalMetricCard
            label="Framework overhead"
            value={`${(data.framework_overhead.ratio * 100).toFixed(1)}%`}
            subtext={`${data.framework_overhead.planning_ops} planning ops / ${data.framework_overhead.planning_ops + data.framework_overhead.source_ops} total`}
            score={data.framework_overhead.score}
          />
        </Identified>
        <Identified as="MetricCard.FrameworkCompliance">
          <SelfEvalMetricCard
            label="Framework compliance"
            value={`${(data.framework_compliance.score * 100).toFixed(0)}%`}
            subtext={`${data.framework_compliance.fully_attributed} of ${data.framework_compliance.completed_tasks} done tasks fully attributed`}
            score={data.framework_compliance.score}
          />
        </Identified>
        <Identified as="MetricCard.Hydration">
          <SelfEvalMetricCard
            label="Hydration overhead"
            value={`${(data.hydration.overhead_ratio * 100).toFixed(1)}%`}
            subtext={`${data.hydration.snapshot_count} snapshots â€¢ ${data.hydration.estimated_snapshot_tokens.toLocaleString()} est tokens`}
            score={1 - Math.min(1, data.hydration.overhead_ratio)}
          />
        </Identified>
        <Identified as="MetricCard.Tasks">
          <SelfEvalMetricCard
            label="Tasks"
            value={`${data.tasks.done} / ${data.tasks.total}`}
            subtext={`${data.tasks.planned} planned Â· ${data.tasks.in_progress} in progress`}
          />
        </Identified>
        <Identified as="MetricCard.Decisions">
          <SelfEvalMetricCard
            label="Decisions"
            value={String(data.decisions)}
            subtext="Captured in DECISIONS.xml"
          />
        </Identified>
      </Identified>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Identified as="SelfEval.ToolDistribution">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tool distribution
            </h3>
            <div className="mt-4 space-y-2.5">
              {topTools.map((t) => (
                <Identified key={t.tool} as={`ToolRow.${t.tool}`}>
                  <SelfEvalToolBar tool={t.tool} count={t.count} max={maxToolCount} />
                </Identified>
              ))}
            </div>
          </div>
        </Identified>

        <Identified as="SelfEval.CliAndPeriod">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              GAD CLI usage
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Identified as="CliStat.Snapshots">
                <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-center">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {data.gad_cli_breakdown.snapshot}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">snapshots</p>
                </div>
              </Identified>
              <Identified as="CliStat.Eval">
                <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-center">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {data.gad_cli_breakdown.eval}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">eval commands</p>
                </div>
              </Identified>
              <Identified as="CliStat.Other">
                <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-center">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {data.gad_cli_breakdown.other}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">other CLI</p>
                </div>
              </Identified>
            </div>

            <Identified as="SelfEval.Period" className="mt-6">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Period
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline">{data.period.start}</Badge>
                  <span className="text-xs text-muted-foreground">â†’</span>
                  <Badge variant="outline">{data.period.end}</Badge>
                  <Badge variant="default">{data.period.days} days</Badge>
                </div>
              </div>
            </Identified>
          </div>
        </Identified>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Computed at {new Date(data.computed_at).toLocaleString()}. Source: .planning/.gad-log/ trace
        data.
      </p>
    </SiteSection>
  );
}


