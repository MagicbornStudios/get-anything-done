import { Identified } from "@/components/devid/Identified";
import { PlanningSystemRuntimeActivityPanel } from "./PlanningSystemRuntimeActivityPanel";
import { PlanningSystemStatCards } from "./PlanningSystemStatCards";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

export type { PlanningSelfEvalLatest } from "./planning-system-types";

export function PlanningSystemTab({ selfEval }: { selfEval: PlanningSelfEvalLatest }) {
  const runtimeDistribution = selfEval.runtime_distribution ?? [];
  const runtimeSessions = selfEval.runtime_sessions ?? [];
  const topRuntimeCount = runtimeDistribution[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <Identified as="PlanningSystemStatCards">
        <PlanningSystemStatCards selfEval={selfEval} />
      </Identified>

      <div className="grid gap-6">
        <PlanningSystemRuntimeActivityPanel
          topRuntimeCount={topRuntimeCount}
          runtimeDistribution={runtimeDistribution}
          runtimeSessions={runtimeSessions}
          activeAssignments={selfEval.active_assignments}
        />
      </div>
    </div>
  );
}
