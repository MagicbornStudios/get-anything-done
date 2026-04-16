"use client";

import { useEffect, useState } from "react";

interface NoteItem {
  id: string;
  title: string;
  updatedAt: string;
  snippet: string;
  relPath: string;
}

interface ProjectPlanningNotesTabProps {
  projectId: string;
}

export function ProjectPlanningNotesTab({
  projectId,
}: ProjectPlanningNotesTabProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
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
      .then((data: { notes?: NoteItem[] }) => {
        if (cancelled) return;
        setNotes(Array.isArray(data.notes) ? data.notes : []);
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
        Loading notes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-400">
        Failed to load notes: {error}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div
        data-cid="project-planning-notes-site-section"
        className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground"
      >
        No .planning notes/docs found for this project.
      </div>
    );
  }

  return (
    <div data-cid="project-planning-notes-site-section" className="space-y-2">
      {notes.map((n) => (
        <article
          key={n.id}
          className="rounded-md border border-border/60 bg-muted/10 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {n.title}
            </h3>
            <time className="text-xs tabular-nums text-muted-foreground">
              {new Date(n.updatedAt).toLocaleDateString()}
            </time>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {n.snippet || "No preview."}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-foreground/80">
              Path
            </summary>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              .planning/{n.relPath}
            </p>
          </details>
        </article>
      ))}
    </div>
  );
}
