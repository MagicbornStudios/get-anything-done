import { Ref } from "@/components/refs/Ref";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
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
    <SiteSection cid="tasks-hero-section-site-section">
      <SiteSectionHeading
        kicker="Tasks"
        as="h1"
        preset="hero"
        title={
          <>
            Every task, every phase. <span className="gradient-text">Permalink per task.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        This page renders every entry in{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-sm">.planning/TASK-REGISTRY.xml</code>,
        grouped by phase. Every task has a stable anchor so other pages can link to <Ref id="22-01" />{" "}
        etc. directly.
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        <a
          href={TASK_FILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-dotted"
        >
          Source: TASK-REGISTRY.xml on GitHub
        </a>
      </SiteProse>

      <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <TasksStat label="Total" value={total.toString()} />
        <TasksStat label="Open" value={openCount.toString()} />
        <TasksStat label="Done" value={doneCount.toString()} />
        <TasksStat label="Cancelled" value={cancelledCount.toString()} />
        <TasksStat label="Phases" value={phaseCount.toString()} />
      </div>
    </SiteSection>
  );
}

