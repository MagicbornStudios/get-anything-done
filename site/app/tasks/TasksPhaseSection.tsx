import Link from "next/link";
import { ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskRecord } from "@/lib/eval-data";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import TaskCard from "./TaskCard";

export default function TasksPhaseSection({
  phaseId,
  tasks,
}: {
  phaseId: string;
  tasks: TaskRecord[];
}) {
  return (
    <SiteSection
      id={`phase-${phaseId}`}
      tone="muted"
      className="last:border-b-0 last:bg-background"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SiteSectionHeading
          icon={ListTodo}
          kicker={`Phase ${phaseId}`}
          kickerRowClassName="mb-0 flex-1 flex-wrap gap-3"
          className="min-w-0 flex-1"
        />
        <Link
          href={`/planning?tab=phases#${phaseId}`}
          className="inline-flex items-center rounded border border-purple-500/40 bg-purple-500/5 px-1.5 py-0.5 font-mono text-[10px] text-purple-300 hover:bg-purple-500/15"
        >
          P-{phaseId}
        </Link>
        <Badge variant="outline" className="shrink-0">
          {tasks.length}
        </Badge>
      </div>
      <div className="space-y-3">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    </SiteSection>
  );
}
