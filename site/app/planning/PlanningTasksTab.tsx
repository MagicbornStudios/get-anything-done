import { Badge } from "@/components/ui/badge";
import { Ref } from "@/components/refs/Ref";
import { RichText } from "@/components/refs/RichText";
import type { TaskRecord } from "@/lib/eval-data";

type PlanningTasksTabProps = {
  allTasks: TaskRecord[];
  openTasks: TaskRecord[];
  doneTasks: TaskRecord[];
  topOpen: TaskRecord[];
};

export function PlanningTasksTab({ allTasks, openTasks, doneTasks, topOpen }: PlanningTasksTabProps) {
  const topOpenIds = new Set(topOpen.map((t) => t.id));

  return (
    <>
      <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          <strong className="text-emerald-400">{doneTasks.length}</strong> done
        </span>
        <span className="opacity-40">·</span>
        <span>
          <strong className="text-accent">{openTasks.length}</strong> open
        </span>
        <span className="opacity-40">·</span>
        <span>
          <strong className="text-foreground">{allTasks.length}</strong> total
        </span>
      </div>
      <div className="space-y-2">
        {topOpen.map((t) => (
          <div
            key={t.id}
            id={t.id}
            className="flex scroll-mt-24 items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3"
          >
            <Ref id={t.id} />
            <div className="min-w-0 flex-1">
              <RichText text={t.goal} className="text-xs text-foreground line-clamp-3" />
            </div>
            <Badge variant={t.status === "in-progress" ? "default" : "outline"} className="shrink-0 text-[10px]">
              {t.status}
            </Badge>
          </div>
        ))}
        {openTasks.length > 40 && (
          <p className="text-xs text-muted-foreground">+ {openTasks.length - 40} more open tasks</p>
        )}
        {allTasks
          .filter((t) => !topOpenIds.has(t.id))
          .map((t) => (
            <span key={t.id} id={t.id} className="sr-only" aria-hidden>
              {t.id}
            </span>
          ))}
      </div>
    </>
  );
}
