import { Badge } from "@/components/ui/badge";
import type { PlanningState } from "@/lib/catalog.generated";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { STATUS_TINT } from "@/app/planning/planning-shared";

export function PlanningOpenTasksSection({ state }: { state: PlanningState }) {
  if (state.openTasks.length === 0) return null;
  return (
    <SiteSection cid="planning-open-tasks-section-site-section">
      <SiteSectionHeading kicker="Open tasks" title="What the agent is working on" />
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
              <Badge variant="outline" className={STATUS_TINT[task.status] ?? STATUS_TINT.planned}>
                {task.status}
              </Badge>
              <p className="mt-2 text-sm leading-6 text-foreground">{task.goal}</p>
            </div>
          </div>
        ))}
      </div>
    </SiteSection>
  );
}

