import type { PlanningState } from "@/lib/catalog.generated";
import type { TaskRecord } from "@/lib/eval-data";
import { STATUS_TINT } from "@/app/planning/planning-shared";

type PlanningRoadmapTabProps = {
  phases: PlanningState["phases"];
  allTasks: TaskRecord[];
};

export function PlanningRoadmapTab({ phases, allTasks }: PlanningRoadmapTabProps) {
  return (
    <div className="space-y-1">
      {phases.map((phase) => {
        const phaseTasks = allTasks.filter((t) => t.phaseId === phase.id);
        const done = phaseTasks.filter((t) => t.status === "done").length;
        const pct = phaseTasks.length > 0 ? Math.round((done / phaseTasks.length) * 100) : 0;
        return (
          <div key={phase.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/20 px-4 py-2.5">
            <span className="w-8 text-xs font-semibold tabular-nums text-muted-foreground">{phase.id}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-foreground">{phase.title}</p>
            </div>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border/40">
              <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
            <span
              className={`w-14 rounded-full border px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase ${
                STATUS_TINT[phase.status] ?? STATUS_TINT.planned
              }`}
            >
              {phase.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
