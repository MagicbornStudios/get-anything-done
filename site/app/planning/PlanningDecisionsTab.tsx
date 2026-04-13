import { Identified } from "@/components/devid/Identified";
import { Ref } from "@/components/refs/Ref";
import type { DecisionRecord } from "@/lib/eval-data";

export function PlanningDecisionsTab({ allDecisions }: { allDecisions: DecisionRecord[] }) {
  return (
    <div className="space-y-2">
      {allDecisions
        .slice(-30)
        .reverse()
        .map((d) => (
          <Identified key={d.id} as={`PlanningDecisionsTabRow-${d.id}`} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3">
            <Ref id={d.id} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{d.title}</p>
              {d.summary && <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{d.summary}</p>}
            </div>
          </Identified>
        ))}
      {allDecisions.length > 30 && (
        <p className="text-xs text-muted-foreground">Showing latest 30 of {allDecisions.length} decisions.</p>
      )}
    </div>
  );
}
