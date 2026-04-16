"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirrors PlanningPhase from project-planning-data.ts)
// ---------------------------------------------------------------------------

interface Phase {
  id: string;
  title: string;
  status: string;
  goal: string;
}

interface Task {
  id: string;
  status: string;
  phase: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TINT: Record<string, string> = {
  done: "border-emerald-500/40 text-emerald-300",
  active: "border-sky-500/40 text-sky-300",
  planned: "border-amber-500/40 text-amber-300",
  cancelled: "border-border/60 text-muted-foreground",
};

const GANTT_BAR_COLOR: Record<string, string> = {
  done: "bg-emerald-500/70",
  active: "bg-sky-500/70",
  planned: "bg-amber-500/30",
  cancelled: "bg-muted/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProjectPlanningRoadmapTabProps {
  projectId: string;
}

export function ProjectPlanningRoadmapTab({ projectId }: ProjectPlanningRoadmapTabProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/dev/evals/projects/${encodeURIComponent(projectId)}/planning`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: { phases?: Phase[]; tasks?: Task[] }) => {
        if (cancelled) return;
        setPhases(data.phases ?? []);
        setTasks(data.tasks ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Pre-compute per-phase progress
  const phaseStats = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const t of tasks) {
      const key = t.phase;
      if (!map.has(key)) map.set(key, { done: 0, total: 0 });
      const s = map.get(key)!;
      s.total++;
      if (t.status === "done") s.done++;
    }
    return map;
  }, [tasks]);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Loading roadmap...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
        Failed to load roadmap: {error}
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        No phases found.
      </div>
    );
  }

  // Summary counters
  const doneCount = phases.filter((p) => p.status === "done").length;
  const activeCount = phases.filter((p) => p.status === "active").length;
  const plannedCount = phases.filter((p) => p.status === "planned").length;

  return (
    <div data-cid="project-planning-roadmap-site-section">
      {/* Summary bar */}
      <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          <strong className="text-emerald-400">{doneCount}</strong> done
        </span>
        <span className="opacity-40">·</span>
        <span>
          <strong className="text-sky-400">{activeCount}</strong> active
        </span>
        <span className="opacity-40">·</span>
        <span>
          <strong className="text-amber-400">{plannedCount}</strong> planned
        </span>
        <span className="opacity-40">·</span>
        <span>
          <strong className="text-foreground">{phases.length}</strong> total
        </span>
      </div>

      {/* Phase rows */}
      <div className="space-y-1">
        {phases.map((phase) => {
          const stats = phaseStats.get(phase.id);
          const pct =
            stats && stats.total > 0
              ? Math.round((stats.done / stats.total) * 100)
              : 0;

          return (
            <div
              key={phase.id}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/20 px-4 py-2.5"
            >
              <span className="w-8 text-xs font-semibold tabular-nums text-muted-foreground">
                {phase.id}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-foreground">{phase.title}</p>
              </div>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full bg-emerald-500/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
                {pct}%
              </span>
              <span
                className={cn(
                  "w-14 rounded-full border px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase",
                  STATUS_TINT[phase.status] ?? STATUS_TINT.planned,
                )}
              >
                {phase.status}
              </span>
            </div>
          );
        })}
      </div>

      {/* Compact Gantt timeline */}
      <GanttTimeline phases={phases} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GanttTimeline -- compact horizontal bar chart
// ---------------------------------------------------------------------------

function GanttTimeline({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) return null;

  // Show at most 30 phases to keep the chart readable
  const visible = phases.slice(0, 30);

  return (
    <div className="mt-6">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Timeline
      </h4>
      <div className="flex gap-px overflow-x-auto rounded-md border border-border/40 bg-card/10 p-1">
        {visible.map((phase) => (
          <div
            key={phase.id}
            className="group relative flex-1 min-w-[18px]"
            title={`${phase.id} - ${phase.title} (${phase.status})`}
          >
            <div
              className={cn(
                "h-5 w-full rounded-sm transition-opacity group-hover:opacity-100",
                GANTT_BAR_COLOR[phase.status] ?? GANTT_BAR_COLOR.planned,
                phase.status === "planned" ? "opacity-60" : "opacity-90",
              )}
            />
            <span className="mt-0.5 block text-center text-[8px] tabular-nums text-muted-foreground">
              {phase.id}
            </span>
          </div>
        ))}
      </div>
      {phases.length > 30 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          + {phases.length - 30} more phases
        </p>
      )}
    </div>
  );
}
