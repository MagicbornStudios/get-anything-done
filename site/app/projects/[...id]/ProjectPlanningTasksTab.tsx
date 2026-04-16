"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlanningTask {
  id: string;
  goal: string;
  status: string;
  phase: string;
  type: string;
  skill: string;
}

interface ProjectPlanningTasksTabProps {
  projectId: string;
}

export function ProjectPlanningTasksTab({ projectId }: ProjectPlanningTasksTabProps) {
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
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
      .then((data: { tasks?: PlanningTask[] }) => {
        if (cancelled) return;
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

  if (loading) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Loading tasks...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
        Failed to load tasks: {error}
      </div>
    );
  }

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const topOpen = openTasks.slice(0, 40);

  return (
    <div data-cid="project-planning-tasks-site-section">
      <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          <strong className="text-emerald-400">{doneTasks.length}</strong> done
        </span>
        <span className="opacity-40">·</span>
        <span>
          <strong className="text-accent">{openTasks.length}</strong> open
        </span>
        <span className="opacity-40">·</span>
        <span>
          <strong className="text-foreground">{tasks.length}</strong> total
        </span>
      </div>
      <div className="space-y-2">
        {topOpen.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3"
          >
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{t.id}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground line-clamp-3">{t.goal}</p>
              {t.phase && (
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  phase {t.phase}
                </span>
              )}
            </div>
            <Badge
              variant={t.status === "in-progress" ? "default" : "outline"}
              className={cn("shrink-0 text-[10px]")}
            >
              {t.status}
            </Badge>
          </div>
        ))}
        {openTasks.length > 40 && (
          <p className="text-xs text-muted-foreground">+ {openTasks.length - 40} more open tasks</p>
        )}
      </div>
    </div>
  );
}
