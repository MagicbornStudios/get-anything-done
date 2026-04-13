import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import type { EvalRunRecord } from "@/lib/eval-data";
import { RunProcessMetricsAgentLineageBlock } from "./RunProcessMetricsAgentLineageBlock";
import { RunProcessMetricsCardGrid } from "./RunProcessMetricsCardGrid";
import { runtimeLabel } from "@/lib/run-process-metrics-runtime-label";

export function RunProcessMetricsSection({ run }: { run: EvalRunRecord }) {
  const runtimesInvolved = (run.runtimesInvolved ?? []).filter(Boolean);
  const lineage = run.agentLineage;
  const topAgents = (lineage?.agents ?? []).slice(0, 6);

  return (
    <SiteSection>
      <Identified as="RunProcessMetrics">
      <Identified as="RunProcessMetricsHeading">
        <SiteSectionHeading kicker="Process metrics" title="How the agent actually worked" />
      </Identified>
      <RunProcessMetricsCardGrid run={run} />

      {runtimesInvolved.length > 0 ? (
        <Identified
          as="RunProcessMetricsRuntimeChips"
          className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"
        >
          {runtimesInvolved.map((runtime, index) => (
            <span
              key={`${String(runtime.id ?? "runtime")}-${index}`}
              className="rounded-full border border-border/60 bg-card/30 px-2.5 py-1"
            >
              {runtimeLabel(runtime)}
            </span>
          ))}
        </Identified>
      ) : null}

      {lineage ? <RunProcessMetricsAgentLineageBlock lineage={lineage} topAgents={topAgents} /> : null}
      </Identified>
    </SiteSection>
  );
}
