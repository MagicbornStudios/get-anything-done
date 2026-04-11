"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Ref } from "@/components/refs/Ref";
import type { PlanningState } from "@/lib/catalog.generated";
import { REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";
import type { TaskRecord, PhaseRecord, DecisionRecord, BugRecord } from "@/lib/eval-data";
import { STATUS_TINT } from "@/app/planning/planning-shared";
import { RichText } from "@/components/refs/RichText";

interface Props {
  state: PlanningState;
  allTasks: TaskRecord[];
  allPhases: PhaseRecord[];
  allDecisions: DecisionRecord[];
  gadBugs: BugRecord[];
}

export function PlanningTabbedContent({ state, allTasks, allPhases, allDecisions, gadBugs }: Props) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "phases";

  const openTasks = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const versions = REQUIREMENTS_HISTORY ?? [];
  const topOpen = openTasks.slice(0, 40);
  const topOpenIds = new Set(topOpen.map((t) => t.id));

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [defaultTab, allTasks.length, state.phases.length, gadBugs.length]);

  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="phases">
              Phases <span className="ml-1.5 tabular-nums text-muted-foreground">{allPhases.length}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks <span className="ml-1.5 tabular-nums text-muted-foreground">{allTasks.length}</span>
            </TabsTrigger>
            <TabsTrigger value="decisions">
              Decisions <span className="ml-1.5 tabular-nums text-muted-foreground">{allDecisions.length}</span>
            </TabsTrigger>
            <TabsTrigger value="roadmap">
              Roadmap
            </TabsTrigger>
            <TabsTrigger value="requirements">
              Requirements <span className="ml-1.5 tabular-nums text-muted-foreground">{versions.length}</span>
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
                  id={phase.id}
                  className="flex scroll-mt-24 items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
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
          </TabsContent>

          {/* Decisions tab */}
          <TabsContent value="decisions">
            <div className="space-y-2">
              {allDecisions.slice(-30).reverse().map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3">
                  <Ref id={d.id} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{d.title}</p>
                    {d.summary && (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{d.summary}</p>
                    )}
                  </div>
                </div>
              ))}
              {allDecisions.length > 30 && (
                <p className="text-xs text-muted-foreground">
                  Showing latest 30 of {allDecisions.length} decisions.
                </p>
              )}
            </div>
          </TabsContent>

          {/* Roadmap tab */}
          <TabsContent value="roadmap">
            <div className="space-y-1">
              {state.phases.map((phase) => {
                const phaseTasks = allTasks.filter((t) => t.phaseId === phase.id);
                const done = phaseTasks.filter((t) => t.status === "done").length;
                const pct = phaseTasks.length > 0 ? Math.round((done / phaseTasks.length) * 100) : 0;
                return (
                  <div key={phase.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/20 px-4 py-2.5">
                    <span className="w-8 text-xs font-semibold tabular-nums text-muted-foreground">{phase.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{phase.title}</p>
                    </div>
                    <div className="w-20 h-1.5 rounded-full bg-border/40 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                    <span className={`w-14 text-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      STATUS_TINT[phase.status] ?? STATUS_TINT.planned
                    }`}>
                      {phase.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Requirements tab */}
          <TabsContent value="requirements">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requirements versions found.</p>
            ) : (
              <div className="space-y-4">
                {versions.map((v) => (
                  <div key={v.version} className="rounded-xl border border-border/60 bg-card/40 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="default">{v.version}</Badge>
                      {v.date && <span className="text-xs text-muted-foreground">{v.date}</span>}
                    </div>
                    {v.sections && Object.entries(v.sections).map(([key, value]) => (
                      <div key={key} className="mt-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          {key.replace(/_/g, " ")}
                        </h4>
                        <p className="text-xs leading-5 text-foreground whitespace-pre-line">{value}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bugs tab */}
          {gadBugs.length > 0 && (
            <TabsContent value="bugs">
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
            </TabsContent>
          )}
        </Tabs>
      </div>
    </section>
  );
}
