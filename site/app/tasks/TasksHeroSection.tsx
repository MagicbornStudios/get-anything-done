import { Ref } from "@/components/refs/Ref";
import { TASK_FILE_URL } from "./tasks-shared";
import TasksStat from "./TasksStat";

export default function TasksHeroSection({
  total,
  openCount,
  doneCount,
  cancelledCount,
  phaseCount,
}: {
  total: number;
  openCount: number;
  doneCount: number;
  cancelledCount: number;
  phaseCount: number;
}) {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Tasks</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          Every task, every phase.{" "}
          <span className="gradient-text">Permalink per task.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          This page renders every entry in{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-sm">
            .planning/TASK-REGISTRY.xml
          </code>
          , grouped by phase. Every task has a stable anchor so other pages can link to{" "}
          <Ref id="22-01" /> etc. directly.
        </p>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          <a
            href={TASK_FILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-dotted"
          >
            Source: TASK-REGISTRY.xml on GitHub
          </a>
        </p>

        <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
          <TasksStat label="Total" value={total.toString()} />
          <TasksStat label="Open" value={openCount.toString()} />
          <TasksStat label="Done" value={doneCount.toString()} />
          <TasksStat label="Cancelled" value={cancelledCount.toString()} />
          <TasksStat label="Phases" value={phaseCount.toString()} />
        </div>
      </div>
    </section>
  );
}
