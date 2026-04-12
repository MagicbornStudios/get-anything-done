import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import type { PlanningPhasePressure } from "./planning-system-types";

export function PlanningSystemPressurePanel({ topPressure }: { topPressure: PlanningPhasePressure[] }) {
  return (
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
  );
}
