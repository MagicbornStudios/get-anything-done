"use client";

import { useEffect, useState } from "react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

type NoteItem = {
  id: string;
  title: string;
  updatedAt: string;
  snippet: string;
  relPath: string;
};

export function PlanningNotesTab() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/planning/notes")
      .then((r) => r.json())
      .then((data: { notes?: NoteItem[] }) => {
        if (cancelled) return;
        setNotes(Array.isArray(data.notes) ? data.notes : []);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteSection cid="planning-notes-site-section">
      <Identified as="PlanningNotesTab">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              Loading notes…
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
              No .planning notes/docs found.
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <article key={n.id} className="rounded-md border border-border/60 bg-muted/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{n.title}</h3>
                    <time className="text-xs tabular-nums text-muted-foreground">
                      {new Date(n.updatedAt).toLocaleDateString()}
                    </time>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{n.snippet || "No preview."}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-foreground/80">Path</summary>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">.planning/{n.relPath}</p>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      </Identified>
    </SiteSection>
  );
}

