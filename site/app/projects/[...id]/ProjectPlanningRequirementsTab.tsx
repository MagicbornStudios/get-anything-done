"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface PlanningRequirement {
  kind: string;
  docPath: string;
  description: string;
}

interface ProjectPlanningRequirementsTabProps {
  projectId: string;
}

export function ProjectPlanningRequirementsTab({
  projectId,
}: ProjectPlanningRequirementsTabProps) {
  const [requirements, setRequirements] = useState<PlanningRequirement[]>([]);
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
      .then((data: { requirements?: PlanningRequirement[] }) => {
        if (cancelled) return;
        setRequirements(data.requirements ?? []);
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
        Loading requirements...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
        Failed to load requirements: {error}
      </div>
    );
  }

  if (requirements.length === 0) {
    return (
      <div
        data-cid="project-planning-requirements-site-section"
        className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground"
      >
        No requirements found for this project.
      </div>
    );
  }

  // Group by kind
  const grouped = new Map<string, PlanningRequirement[]>();
  for (const req of requirements) {
    const key = req.kind || "uncategorized";
    const list = grouped.get(key);
    if (list) {
      list.push(req);
    } else {
      grouped.set(key, [req]);
    }
  }

  return (
    <div data-cid="project-planning-requirements-site-section" className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <strong className="text-foreground">{requirements.length}</strong>{" "}
        requirement {requirements.length === 1 ? "entry" : "entries"} across{" "}
        <strong className="text-foreground">{grouped.size}</strong>{" "}
        {grouped.size === 1 ? "category" : "categories"}
      </div>

      {[...grouped.entries()].map(([kind, items]) => (
        <div
          key={kind}
          className="rounded-xl border border-border/60 bg-card/40 p-5"
        >
          <div className="mb-3 flex items-center gap-3">
            <Badge variant="default">
              {kind.replace(/[-_]/g, " ")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "doc" : "docs"}
            </span>
          </div>
          <div className="space-y-3">
            {items.map((req, i) => (
              <div key={`${kind}-${i}`} className="space-y-1">
                {req.docPath && (
                  <p className="font-mono text-[11px] text-accent/80">
                    {req.docPath}
                  </p>
                )}
                {req.description && (
                  <p className="whitespace-pre-line text-xs leading-5 text-foreground/90">
                    {req.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
