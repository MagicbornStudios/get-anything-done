"use client";

import { Badge } from "@/components/ui/badge";
import { Ref } from "@/components/refs/Ref";
import { RichText } from "@/components/refs/RichText";
import type { PlanningPhase } from "@/lib/catalog.generated";
import type { TaskRecord } from "@/lib/eval-data";

type PlanningGanttSelectedPhasePanelProps = {
  selectedPhase: PlanningPhase | undefined;
  selectedTasks: TaskRecord[];
};

export function PlanningGanttSelectedPhasePanel({
  selectedPhase,
  selectedTasks,
}: PlanningGanttSelectedPhasePanelProps) {
  if (!selectedPhase) return null;

  return (
    <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm font-semibold text-accent">Phase {selectedPhase.id}</span>
        <Badge
          variant={
            selectedPhase.status === "done"
              ? "success"
              : selectedPhase.status === "active"
                ? "default"
                : "outline"
          }
        >
          {selectedPhase.status}
        </Badge>
        <span className="text-sm text-foreground">{selectedPhase.title}</span>
      </div>

      {selectedTasks.length > 0 ? (
        <div className="space-y-2">
          {selectedTasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/30 p-3">
              <Ref id={t.id} />
              <div className="min-w-0 flex-1">
                <RichText text={t.goal} className="text-xs text-foreground line-clamp-3" />
              </div>
              <Badge
                variant={
                  t.status === "done"
                    ? "success"
                    : t.status === "in-progress"
                      ? "default"
                      : t.status === "cancelled"
                        ? "outline"
                        : "outline"
                }
                className="shrink-0 text-[10px]"
              >
                {t.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No tasks found for this phase.</p>
      )}
    </div>
  );
}
