import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planningFmtCount } from "./planning-system-format";
import type { PlanningEvalProjectBreakdown } from "./planning-system-types";

export function PlanningSystemEvalProjectsPanel({ topProjects }: { topProjects: PlanningEvalProjectBreakdown[] }) {
  return (
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
  );
}
