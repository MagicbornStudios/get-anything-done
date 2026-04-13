import { Identified } from "@/components/devid/Identified";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvalRunRecord } from "@/lib/eval-data";

type Lineage = NonNullable<EvalRunRecord["agentLineage"]>;

export function RunProcessMetricsAgentLineageBlock({
  lineage,
  topAgents,
}: {
  lineage: Lineage;
  topAgents: Lineage["agents"];
}) {
  if (topAgents.length === 0) return null;

  return (
    <Identified as="RunProcessMetricsAgentLineage" className="mt-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Agent lineage</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {topAgents.map((agent, index) => (
          <Identified
            key={`${agent.agent_id ?? agent.agent_role ?? "agent"}-${index}`}
            as="RunProcessMetricsAgentLaneCard"
            className="contents"
          >
            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <CardDescription>
                  {(agent.runtime ?? "unknown")} · depth {agent.depth ?? "—"}
                </CardDescription>
                <CardTitle className="text-base">
                  {agent.agent_id ?? agent.agent_role ?? "anonymous lane"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0 text-xs text-muted-foreground">
                <div>
                  role {agent.agent_role ?? "unknown"}
                  {agent.resolved_model ? ` · ${agent.resolved_model}` : ""}
                </div>
                <div>
                  {agent.event_count} event(s) · {agent.tool_use_count} tools ·{" "}
                  {agent.file_mutation_count} file mutations
                </div>
                <div>
                  parent {agent.parent_agent_id ?? "—"} · root{" "}
                  {agent.root_agent_id ?? agent.agent_id ?? "—"}
                </div>
              </CardContent>
            </Card>
          </Identified>
        ))}
      </div>
      {lineage.agents.length > topAgents.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {topAgents.length} of {lineage.agents.length} traced agents for this run.
        </p>
      ) : null}
    </Identified>
  );
}
