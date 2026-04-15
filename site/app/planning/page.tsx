import { Suspense } from "react";
import { MarketingShell } from "@/components/site";
import { HUMAN_WORKFLOWS, PLANNING_STATE, SIGNAL } from "@/lib/catalog.generated";
import { ALL_TASKS, ALL_PHASES, ALL_DECISIONS, BUGS } from "@/lib/eval-data";
import {
  DEFAULT_PROJECT_ID,
  REGISTERED_PROJECTS,
} from "@/lib/project-config";
import { PlanningGanttSprintProvider } from "./PlanningGanttSprintContext";
import { PlanningTabbedContent } from "./PlanningTabbedContent";

export const metadata = {
  title: "Planning state — GAD self-transparency",
  description:
    "Phases, tasks, decisions, roadmap, requirements, and bugs driving the get-anything-done framework.",
};

// Task 44-30: route-level scoping via ?projectid=. BUGS carry a project
// field so we filter here; tasks/phases/decisions are still single-project
// at build time (Option B in scoping research, deferred to follow-up).
type PageSearchParams = Promise<{ projectid?: string | string[] }>;

export default async function PlanningStatePage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const state = PLANNING_STATE;
  const rawProjectId = resolvedSearchParams?.projectid;
  const paramId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const currentProject =
    paramId && REGISTERED_PROJECTS.some((p) => p.id === paramId)
      ? paramId
      : DEFAULT_PROJECT_ID;
  // Legacy hardcoded filter pinned BUGS to "gad"; keep that alias for the
  // framework project id so pre-existing bug records stay visible.
  const bugProjectAliases =
    currentProject === "get-anything-done"
      ? ["get-anything-done", "gad"]
      : [currentProject];
  const gadBugs = (BUGS ?? []).filter(
    (b) => !b.project || bugProjectAliases.includes(b.project),
  );

  return (
    <MarketingShell>
      <PlanningGanttSprintProvider phases={state.phases}>
        <Suspense>
          <PlanningTabbedContent
            state={state}
            allTasks={ALL_TASKS}
            allPhases={ALL_PHASES}
            allDecisions={ALL_DECISIONS}
            gadBugs={gadBugs}
            humanWorkflows={HUMAN_WORKFLOWS}
            signal={SIGNAL}
          />
        </Suspense>
      </PlanningGanttSprintProvider>
    </MarketingShell>
  );
}
