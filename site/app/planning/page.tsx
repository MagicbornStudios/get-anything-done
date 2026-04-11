import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { PLANNING_STATE } from "@/lib/catalog.generated";
import { PlanningDecisionsSection } from "@/app/planning/PlanningDecisionsSection";
import { PlanningOpenTasksSection } from "@/app/planning/PlanningOpenTasksSection";
import { PlanningOverviewSection } from "@/app/planning/PlanningOverviewSection";
import { PlanningRoadmapSection } from "@/app/planning/PlanningRoadmapSection";

export const metadata = {
  title: "Planning state — GAD self-transparency",
  description:
    "The current phase, open tasks, and recent decisions driving the get-anything-done framework and this site. Parsed directly from .planning/ XML files.",
};

export default function PlanningStatePage() {
  const state = PLANNING_STATE;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <PlanningOverviewSection state={state} />
      <PlanningRoadmapSection state={state} />
      <PlanningOpenTasksSection state={state} />
      <PlanningDecisionsSection state={state} />
      <Footer />
    </main>
  );
}
