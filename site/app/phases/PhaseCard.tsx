import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import type { PhaseRecord } from "@/lib/eval-data";
import { STATUS_TINT, tasksForPhase } from "@/app/phases/phases-shared";

export function PhaseCard({ phase }: { phase: PhaseRecord }) {
  const tasks = tasksForPhase(phase.id);
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const openCount = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <Card id={phase.id} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Ref id={`P-${phase.id}`} />
          <Badge variant={STATUS_TINT[phase.status] ?? "outline"}>{phase.status}</Badge>
          <CardTitle className="text-lg leading-tight">{phase.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {phase.goal && (
          <p className="text-sm leading-6 text-muted-foreground">{phase.goal}</p>
        )}
        {phase.outcome && (
          <p className="mt-3 border-l-2 border-accent/60 pl-3 text-xs leading-5 italic text-muted-foreground">
            Outcome: {phase.outcome}
          </p>
        )}

        {tasks.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-border/40 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  <strong className="text-foreground">{doneCount}</strong> done
                </span>
                <span className="opacity-40">·</span>
                <span>
                  <strong className="text-foreground">{openCount}</strong> open
                </span>
                <span className="opacity-40">·</span>
                <span>
                  <strong className="text-foreground">{tasks.length}</strong> total
                </span>
              </div>
              <Link
                href={`/tasks#phase-${phase.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                View all tasks
                <ArrowRight size={10} aria-hidden />
              </Link>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-background/60">
              <div
                className="h-full rounded-full bg-emerald-500/70"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {tasks.slice(0, 12).map((t) => (
                <Ref key={t.id} id={t.id} />
              ))}
              {tasks.length > 12 && (
                <span className="inline-flex items-center rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  +{tasks.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
