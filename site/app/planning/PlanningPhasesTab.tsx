import { Badge } from "@/components/ui/badge";
import type { PlanningState } from "@/lib/catalog.generated";
import { STATUS_TINT } from "@/app/planning/planning-shared";
import { cn } from "@/lib/utils";

export function PlanningPhasesTab({ phases }: { phases: PlanningState["phases"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {phases.map((phase) => (
        <div
          key={phase.id}
          id={phase.id}
          className="flex scroll-mt-24 items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
        >
          <Badge
            variant="outline"
            className="mt-0.5 min-w-10 shrink-0 justify-center bg-background/60 px-2 py-0.5 text-xs font-semibold normal-case tracking-normal tabular-nums text-muted-foreground"
          >
            {phase.id}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground">{phase.title}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal",
              STATUS_TINT[phase.status] ?? STATUS_TINT.planned,
            )}
          >
            {phase.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
