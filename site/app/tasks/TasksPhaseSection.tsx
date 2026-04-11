import Link from "next/link";
import { ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskRecord } from "@/lib/eval-data";
import TaskCard from "./TaskCard";

export default function TasksPhaseSection({
  phaseId,
  tasks,
}: {
  phaseId: string;
  tasks: TaskRecord[];
}) {
  return (
    <section
      id={`phase-${phaseId}`}
      className="border-b border-border/60 bg-card/20 last:bg-background"
    >
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-3">
          <ListTodo size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Phase {phaseId}</p>
          <Link
            href={`/planning?tab=phases#${phaseId}`}
            className="inline-flex items-center rounded border border-purple-500/40 bg-purple-500/5 px-1.5 py-0.5 font-mono text-[10px] text-purple-300 hover:bg-purple-500/15"
          >
            P-{phaseId}
          </Link>
          <Badge variant="outline">{tasks.length}</Badge>
        </div>
        <div className="space-y-3">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
