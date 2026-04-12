import { PlanningSystemEvalProjectsPanel } from "./PlanningSystemEvalProjectsPanel";
import { PlanningSystemEvalTelemetryPanel } from "./PlanningSystemEvalTelemetryPanel";
import { PlanningSystemPressurePanel } from "./PlanningSystemPressurePanel";
import { PlanningSystemProjectTokensPanel } from "./PlanningSystemProjectTokensPanel";
import { PlanningSystemRuntimeActivityPanel } from "./PlanningSystemRuntimeActivityPanel";
import { PlanningSystemStatCards } from "./PlanningSystemStatCards";
import type { PlanningSelfEvalLatest } from "./planning-system-types";

export type { PlanningSelfEvalLatest } from "./planning-system-types";

export function PlanningSystemTab({ selfEval }: { selfEval: PlanningSelfEvalLatest }) {
  const runtimeDistribution = selfEval.runtime_distribution ?? [];
  const runtimeSessions = selfEval.runtime_sessions ?? [];
  const evals = selfEval.evals;
  const projectTokens = selfEval.project_tokens;
  const topRuntimeCount = runtimeDistribution[0]?.count ?? 1;
  const topEvalRuntimeCount = evals?.runtime_distribution?.[0]?.count ?? 1;
  const topPressure = [...selfEval.phases_pressure]
    .sort((a, b) => b.pressure_score - a.pressure_score)
    .slice(0, 8);
  const topProjects = (evals?.project_breakdown ?? []).slice(0, 8);
  const topProjectTokenSource = projectTokens?.sources?.[0]?.estimated_total_tokens ?? 1;

  return (
    <div className="space-y-6">
      <PlanningSystemStatCards selfEval={selfEval} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PlanningSystemProjectTokensPanel selfEval={selfEval} topProjectTokenSource={topProjectTokenSource} />
        <PlanningSystemRuntimeActivityPanel
          topRuntimeCount={topRuntimeCount}
          runtimeDistribution={runtimeDistribution}
          runtimeSessions={runtimeSessions}
        />
        <PlanningSystemEvalTelemetryPanel selfEval={selfEval} topEvalRuntimeCount={topEvalRuntimeCount} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PlanningSystemPressurePanel topPressure={topPressure} />
        <PlanningSystemEvalProjectsPanel topProjects={topProjects} />
      </div>
    </div>
  );
}
