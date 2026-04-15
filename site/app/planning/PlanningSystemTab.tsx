import { Identified } from "@/components/devid/Identified";
import { PlanningSystemProjectTokensPanel } from "./PlanningSystemProjectTokensPanel";
import { PlanningSystemRuntimeActivityPanel } from "./PlanningSystemRuntimeActivityPanel";
import { PlanningSystemStatCards } from "./PlanningSystemStatCards";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

export type { PlanningSelfEvalLatest } from "./planning-system-types";

export function PlanningSystemTab({ selfEval }: { selfEval: PlanningSelfEvalLatest }) {
  const runtimeDistribution = selfEval.runtime_distribution ?? [];
  const runtimeSessions = selfEval.runtime_sessions ?? [];
  const projectTokens = selfEval.project_tokens;
  const topRuntimeCount = runtimeDistribution[0]?.count ?? 1;
  const topProjectTokenSource = projectTokens?.sources?.[0]?.estimated_total_tokens ?? 1;

  return (
    <div className="space-y-6">
      <Identified as="PlanningSystemStatCards">
        <PlanningSystemStatCards selfEval={selfEval} />
      </Identified>

      <div className="grid gap-6 xl:grid-cols-2">
        <Identified as="PlanningSystemProjectTokensPanel">
          <PlanningSystemProjectTokensPanel selfEval={selfEval} topProjectTokenSource={topProjectTokenSource} />
        </Identified>
        <Identified as="PlanningSystemRuntimeActivityPanel">
          <PlanningSystemRuntimeActivityPanel
            topRuntimeCount={topRuntimeCount}
            runtimeDistribution={runtimeDistribution}
            runtimeSessions={runtimeSessions}
            activeAssignments={selfEval.active_assignments}
          />
        </Identified>
      </div>
    </div>
  );
}
