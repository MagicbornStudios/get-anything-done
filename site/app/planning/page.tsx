import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { PLANNING_STATE } from "@/lib/catalog.generated";
import { ALL_TASKS, ALL_PHASES, ALL_DECISIONS, BUGS } from "@/lib/eval-data";
import { PlanningOverviewSection } from "@/app/planning/PlanningOverviewSection";
import { PlanningGanttSection } from "@/app/planning/PlanningGanttSection";
import { PlanningTabbedContent } from "@/app/planning/PlanningTabbedContent";

export const metadata = {
  title: "Planning state — GAD self-transparency",
  description:
    "Phases, tasks, decisions, and bugs driving the get-anything-done framework. Parsed directly from .planning/ XML files.",
};

export default function PlanningStatePage() {
  const state = PLANNING_STATE;

  // Separate GAD-level bugs (no project) from eval bugs (have project)
  const gadBugs = (BUGS ?? []).filter((b) => !b.project || b.project === "gad");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <PlanningOverviewSection state={state} />
      <PlanningGanttSection phases={state.phases} />
      <PlanningTabbedContent
        state={state}
        allTasks={ALL_TASKS}
        allPhases={ALL_PHASES}
        allDecisions={ALL_DECISIONS}
        gadBugs={gadBugs}
      />
      <Footer />
    </main>
  );
}
