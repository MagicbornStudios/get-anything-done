"use client";

import { useEffect, useState } from "react";

interface PlanningDecision {
  id: string;
  title: string;
  summary: string;
  impact: string;
  references: string[];
}

interface ProjectPlanningDecisionsTabProps {
  projectId: string;
}

const DEFAULT_VISIBLE = 30;

export function ProjectPlanningDecisionsTab({ projectId }: ProjectPlanningDecisionsTabProps) {
  const [decisions, setDecisions] = useState<PlanningDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/dev/evals/projects/${encodeURIComponent(projectId)}/planning`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: { decisions?: PlanningDecision[] }) => {
        if (cancelled) return;
        setDecisions(data.decisions ?? []);
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
        Loading decisions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
        Failed to load decisions: {error}
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        No decisions recorded for this project.
      </div>
    );
  }

  // Newest first
  const ordered = [...decisions].reverse();
  const visible = expanded ? ordered : ordered.slice(0, DEFAULT_VISIBLE);
  const hasMore = decisions.length > DEFAULT_VISIBLE;

  return (
    <div data-cid="project-planning-decisions-site-section">
      <div className="mb-4 text-sm text-muted-foreground">
        <strong className="text-foreground">{decisions.length}</strong> decisions
      </div>
      <div className="space-y-2">
        {visible.map((d) => (
          <div
            key={d.id}
            className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 p-3"
          >
            <code className="shrink-0 rounded-md bg-background/60 px-2 py-1 font-mono text-[10px] text-accent">
              {d.id}
            </code>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground">{d.title}</p>
              {d.summary && (
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                  {d.summary}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs font-medium text-accent hover:underline"
        >
          Show all {decisions.length} decisions
        </button>
      )}
      {hasMore && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 text-xs font-medium text-accent hover:underline"
        >
          Show latest {DEFAULT_VISIBLE} only
        </button>
      )}
    </div>
  );
}
