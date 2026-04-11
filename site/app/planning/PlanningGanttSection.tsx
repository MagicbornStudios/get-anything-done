"use client";

import { useState } from "react";
import { GanttChart, type GanttItem } from "@/components/charts/GanttChart";
import type { PlanningPhase } from "@/lib/catalog.generated";

function buildGanttItems(phases: PlanningPhase[]): { items: GanttItem[]; columns: string[] } {
  // Each phase gets one column position based on its index
  const columns = phases.map((p) => p.id);

  const items: GanttItem[] = phases.map((phase, idx) => ({
    id: phase.id,
    label: `${phase.id} — ${phase.title}`,
    start: idx,
    duration: 1,
    status: phase.status,
    stats: {
      Phase: phase.id,
      Status: phase.status,
      Title: phase.title,
    },
  }));

  return { items, columns };
}

export function PlanningGanttSection({ phases }: { phases: PlanningPhase[] }) {
  const { items, columns } = buildGanttItems(phases);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const selected = phases.find((p) => p.id === selectedPhase);

  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Phase timeline</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          All {phases.length} phases at a glance
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Click a phase for details. Hover for stats. Green = done, blue = active, amber = planned.
        </p>
        <div className="mt-8">
          <GanttChart
            items={items}
            columns={columns}
            onItemClick={(item) => setSelectedPhase(item.id === selectedPhase ? null : item.id)}
            selectedId={selectedPhase}
          />
        </div>

        {selected && (
          <div className="mt-6 rounded-xl border border-accent/40 bg-accent/5 p-5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-accent">Phase {selected.id}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                selected.status === "done" ? "border-emerald-500/40 text-emerald-300" :
                selected.status === "active" ? "border-sky-500/40 text-sky-300" :
                "border-amber-500/40 text-amber-300"
              }`}>
                {selected.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground">{selected.title}</p>
          </div>
        )}
      </div>
    </section>
  );
}
