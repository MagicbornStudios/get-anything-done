import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCount } from "./planning-system-format";
import type { PlanningActiveAgentLane, PlanningDepthCount, PlanningRuntimeCount } from "./planning-system-types";

type PlanningSystemRuntimeActivityPanelProps = {
  topRuntimeCount: number;
  runtimeDistribution: PlanningRuntimeCount[];
  runtimeSessions: PlanningRuntimeCount[];
  activeAssignments?: {
    depth_distribution: PlanningDepthCount[];
    active_agents: PlanningActiveAgentLane[];
    stale_agents: PlanningActiveAgentLane[];
  };
};

export function PlanningSystemRuntimeActivityPanel({
  topRuntimeCount,
  runtimeDistribution,
  runtimeSessions,
  activeAssignments,
}: PlanningSystemRuntimeActivityPanelProps) {
  const topActiveAgents = (activeAssignments?.active_agents ?? []).slice(0, 5);
  return (
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
          {(activeAssignments?.depth_distribution ?? []).map((entry) => (
            <Badge key={`depth-${entry.depth}`} variant="outline">
              depth {entry.depth}: {planningFmtCount(entry.count)} lane{entry.count === 1 ? "" : "s"}
            </Badge>
          ))}
        </div>
        {topActiveAgents.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-background/30 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Active agent lanes</p>
            <div className="space-y-2 text-xs text-muted-foreground">
              {topActiveAgents.map((lane) => (
                <div key={lane.agent_id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-foreground">{lane.agent_id}</p>
                    <p>
                      {lane.runtime} · role={lane.agent_role} · depth={lane.depth}
                      {lane.resolved_model ? ` · ${lane.resolved_model}` : lane.model_profile ? ` · ${lane.model_profile}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">{lane.tasks.length} task{lane.tasks.length === 1 ? "" : "s"}</Badge>
                </div>
              ))}
            </div>
            {(activeAssignments?.stale_agents?.length ?? 0) > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {planningFmtCount(activeAssignments?.stale_agents.length)} stale lane(s) are being tracked separately.
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          This is pseudo real-time operational telemetry from the monorepo `.planning/.gad-log/`. It measures
          active system usage plus live assignment state from `.planning/.gad-agent-lanes.json`, not just preserved eval runs.
        </p>
      </CardContent>
    </Card>
  );
}
