"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Ref } from "@/components/refs/Ref";
import type { PlanningState, PlanningPhase } from "@/lib/catalog.generated";
import type { TaskRecord, PhaseRecord, DecisionRecord, BugRecord } from "@/lib/eval-data";
import { STATUS_TINT } from "@/app/planning/planning-shared";

interface Props {
  state: PlanningState;
  allTasks: TaskRecord[];
  allPhases: PhaseRecord[];
  allDecisions: DecisionRecord[];
  gadBugs: BugRecord[];
}

export function PlanningTabbedContent({ state, allTasks, allPhases, allDecisions, gadBugs }: Props) {
  const openTasks = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = allTasks.filter((t) => t.status === "done");

  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <Tabs defaultValue="phases">
          <TabsList className="mb-6">
            <TabsTrigger value="phases">
              Phases <span className="ml-1.5 tabular-nums text-muted-foreground">{allPhases.length}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks <span className="ml-1.5 tabular-nums text-muted-foreground">{allTasks.length}</span>
            </TabsTrigger>
            <TabsTrigger value="decisions">
              Decisions <span className="ml-1.5 tabular-nums text-muted-foreground">{allDecisions.length}</span>
            </TabsTrigger>
            {gadBugs.length > 0 && (
              <TabsTrigger value="bugs">
                Bugs <span className="ml-1.5 tabular-nums text-muted-foreground">{gadBugs.length}</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Phases tab */}
          <TabsContent value="phases">
            <div className="grid gap-3 md:grid-cols-2">
              {state.phases.map((phase) => (
                <div
                  key={phase.id}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
                >
                  <span className="mt-0.5 inline-flex min-w-10 shrink-0 items-center justify-center rounded-full bg-background/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {phase.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{phase.title}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      STATUS_TINT[phase.status] ?? STATUS_TINT.planned
                    }`}
                  >
                    {phase.status}
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Tasks tab */}
          <TabsContent value="tasks">
            <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
              <span><strong className="text-emerald-400">{doneTasks.length}</strong> done</span>
              <span className="opacity-40">·</span>
              <span><strong className="text-accent">{openTasks.length}</strong> open</span>
              <span className="opacity-40">·</span>
              <span><strong className="text-foreground">{allTasks.length}</strong> total</span>
            </div>
            <div className="space-y-2">
              {openTasks.slice(0, 30).map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3">
                  <Ref id={t.id} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground line-clamp-2">{t.goal}</p>
                  </div>
                  <Badge variant={t.status === "in-progress" ? "default" : "outline"} className="shrink-0 text-[10px]">
                    {t.status}
                  </Badge>
                </div>
              ))}
              {openTasks.length > 30 && (
                <p className="text-xs text-muted-foreground">+ {openTasks.length - 30} more open tasks</p>
              )}
            </div>
          </TabsContent>

          {/* Decisions tab */}
          <TabsContent value="decisions">
            <div className="space-y-2">
              {allDecisions.slice(-20).reverse().map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3">
                  <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                    {d.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{d.title}</p>
                    {d.summary && (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{d.summary}</p>
                    )}
                  </div>
                </div>
              ))}
              {allDecisions.length > 20 && (
                <p className="text-xs text-muted-foreground">
                  Showing latest 20 of {allDecisions.length} decisions.{" "}
                  <a href="/decisions" className="text-accent hover:underline">View all →</a>
                </p>
              )}
            </div>
          </TabsContent>

          {/* Bugs tab */}
          {gadBugs.length > 0 && (
            <TabsContent value="bugs">
              <div className="space-y-2">
                {gadBugs.map((b) => (
                  <div key={b.id} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3">
                    <Badge variant={b.status === "resolved" ? "success" : "danger"} className="shrink-0 text-[10px]">
                      {b.status}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{b.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </section>
  );
}
