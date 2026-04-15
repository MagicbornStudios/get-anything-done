import type { PlanningState } from "@/lib/catalog.generated";
import { PlanningGanttSection } from "./PlanningGanttSection";

export function PlanningPhasesTab({ phases }: { phases: PlanningState["phases"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <PlanningGanttSection />
    </div>
  );
}
