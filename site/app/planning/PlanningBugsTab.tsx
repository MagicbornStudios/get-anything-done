import { Badge } from "@/components/ui/badge";
import type { BugRecord } from "@/lib/eval-data";

export function PlanningBugsTab({ gadBugs }: { gadBugs: BugRecord[] }) {
  return (
    <div className="space-y-2">
      {gadBugs.map((b) => (
        <div
          key={b.id}
          id={b.id}
          className="flex scroll-mt-24 items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3"
        >
          <Badge variant={b.status === "resolved" ? "success" : "danger"} className="shrink-0 text-[10px]">
            {b.status}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">{b.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
