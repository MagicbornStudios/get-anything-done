import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { ALL_TASKS } from "@/lib/eval-data";
import { groupByPhase } from "./tasks-shared";
import TasksHeroSection from "./TasksHeroSection";
import TasksPhaseSection from "./TasksPhaseSection";

export const metadata = {
  title: "Tasks — GAD",
  description:
    "Every task in .planning/TASK-REGISTRY.xml rendered with stable anchors. Grouped by phase, filtered by status.",
};

export default function TasksPage() {
  const open = ALL_TASKS.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = ALL_TASKS.filter((t) => t.status === "done");
  const cancelled = ALL_TASKS.filter((t) => t.status === "cancelled");
  const byPhase = groupByPhase(ALL_TASKS);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <TasksHeroSection
        total={ALL_TASKS.length}
        openCount={open.length}
        doneCount={done.length}
        cancelledCount={cancelled.length}
        phaseCount={byPhase.length}
      />

      {byPhase.map(([phaseId, tasks]) => (
        <TasksPhaseSection key={phaseId} phaseId={phaseId} tasks={tasks} />
      ))}

      <Footer />
    </main>
  );
}
