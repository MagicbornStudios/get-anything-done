import { Suspense } from "react";
import { MarketingShell } from "@/components/site";
import { PLANNING_STATE } from "@/lib/catalog.generated";
import { ALL_TASKS, ALL_PHASES, ALL_DECISIONS, BUGS } from "@/lib/eval-data";
import { PlanningGanttSection } from "./PlanningGanttSection";
import { PlanningOverviewSection } from "./PlanningOverviewSection";
import { PlanningTabbedContent } from "./PlanningTabbedContent";

export const metadata = {
  title: "Planning state — GAD self-transparency",
  description:
    "Phases, tasks, decisions, roadmap, requirements, and bugs driving the get-anything-done framework.",
};

export default function PlanningStatePage() {
  const state = PLANNING_STATE;
  const gadBugs = (BUGS ?? []).filter((b) => !b.project || b.project === "gad");

  return (
    <MarketingShell>
      <PlanningOverviewSection state={state} />
      <PlanningGanttSection phases={state.phases} />
      <Suspense>
        <PlanningTabbedContent
          state={state}
          allTasks={ALL_TASKS}
          allPhases={ALL_PHASES}
          allDecisions={ALL_DECISIONS}
          gadBugs={gadBugs}
        />
      </Suspense>
    </MarketingShell>
  );
}
