import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanningSystemBarRow } from "./PlanningSystemBarRow";
import { planningFmtCount } from "./planning-system-format";
import type { PlanningRuntimeCount } from "./planning-system-types";

type PlanningSystemRuntimeActivityPanelProps = {
  topRuntimeCount: number;
  runtimeDistribution: PlanningRuntimeCount[];
  runtimeSessions: PlanningRuntimeCount[];
};

export function PlanningSystemRuntimeActivityPanel({
  topRuntimeCount,
  runtimeDistribution,
  runtimeSessions,
}: PlanningSystemRuntimeActivityPanelProps) {
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
        </div>
        <p className="text-xs text-muted-foreground">
          This is pseudo real-time operational telemetry from the monorepo `.planning/.gad-log/`. It measures
          active system usage, not just preserved eval runs.
        </p>
      </CardContent>
    </Card>
  );
}
