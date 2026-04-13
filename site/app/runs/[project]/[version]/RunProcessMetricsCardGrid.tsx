import { Identified } from "@/components/devid/Identified";
import type { EvalRunRecord } from "@/lib/eval-data";
import { RunProcessMetricsAgentLanesSummaryCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsAgentLanesSummaryCard";
import { RunProcessMetricsCommitsCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsCommitsCard";
import { RunProcessMetricsEndedAtCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsEndedAtCard";
import { RunProcessMetricsObservedDepthCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsObservedDepthCard";
import { RunProcessMetricsPlanningDocsCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsPlanningDocsCard";
import { RunProcessMetricsPrimaryRuntimeCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsPrimaryRuntimeCard";
import { RunProcessMetricsStartedAtCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsStartedAtCard";
import { RunProcessMetricsToolUsesCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsToolUsesCard";
import { RunProcessMetricsWallClockCard } from "@/components/run-detail/process-metric-cards/RunProcessMetricsWallClockCard";

export function RunProcessMetricsCardGrid({ run }: { run: EvalRunRecord }) {
  const started = typeof run.timing?.started === "string" ? run.timing.started : null;
  const ended = typeof run.timing?.ended === "string" ? run.timing.ended : null;
  const lineage = run.agentLineage;

  return (
    <Identified as="RunProcessMetricsCards" className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      <RunProcessMetricsPrimaryRuntimeCard run={run} />

      {lineage ? (
        <>
          <RunProcessMetricsAgentLanesSummaryCard lineage={lineage} />
          <RunProcessMetricsObservedDepthCard lineage={lineage} />
        </>
      ) : null}

      {run.timing ? (
        <>
          <RunProcessMetricsWallClockCard timing={run.timing} />
          <RunProcessMetricsStartedAtCard started={started} />
          <RunProcessMetricsEndedAtCard ended={ended} />
        </>
      ) : null}

      {run.tokenUsage ? <RunProcessMetricsToolUsesCard tokenUsage={run.tokenUsage} /> : null}

      {run.gitAnalysis ? <RunProcessMetricsCommitsCard gitAnalysis={run.gitAnalysis} /> : null}

      {run.planningQuality ? (
        <RunProcessMetricsPlanningDocsCard planningQuality={run.planningQuality} />
      ) : null}
    </Identified>
  );
}
