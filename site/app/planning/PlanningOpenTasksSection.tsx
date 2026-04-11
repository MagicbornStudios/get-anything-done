import { Badge } from "@/components/ui/badge";
import type { PlanningState } from "@/lib/catalog.generated";
import { STATUS_TINT } from "@/app/planning/planning-shared";

export function PlanningOpenTasksSection({ state }: { state: PlanningState }) {
  if (state.openTasks.length === 0) return null;
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Open tasks</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          What the agent is working on
        </h2>
        <div className="mt-8 space-y-3">
          {state.openTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/40 p-5"
            >
              <code className="shrink-0 rounded-md bg-background/60 px-2 py-1 font-mono text-xs text-accent">
                {task.id}
              </code>
              <div className="min-w-0 flex-1">
                <Badge
                  variant="outline"
                  className={STATUS_TINT[task.status] ?? STATUS_TINT.planned}
                >
                  {task.status}
                </Badge>
                <p className="mt-2 text-sm leading-6 text-foreground">{task.goal}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
