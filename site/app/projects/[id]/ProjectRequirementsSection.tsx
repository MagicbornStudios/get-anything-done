"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";

type RequirementsVersion = (typeof REQUIREMENTS_HISTORY)[number];

export function ProjectRequirementsSection({ projectId }: { projectId: string }) {
  const versions = REQUIREMENTS_HISTORY;
  const [currentIdx, setCurrentIdx] = useState(versions.length - 1);

  if (versions.length === 0) return null;

  const current = versions[currentIdx];
  const prev = currentIdx > 0 ? versions[currentIdx - 1] : null;

  return (
    <section className="border-t border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Requirements history</p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {versions.length} version{versions.length !== 1 ? "s" : ""} — each change triggers a new round
        </h2>

        {/* Version pagination */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <ChevronLeft size={12} />
            Prev
          </button>
          <div className="flex gap-1.5">
            {versions.map((v, i) => (
              <button
                key={v.version}
                type="button"
                onClick={() => setCurrentIdx(i)}
                className={[
                  "size-8 rounded-full text-xs font-semibold transition-colors",
                  i === currentIdx
                    ? "border border-accent bg-accent text-accent-foreground"
                    : "border border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60",
                ].join(" ")}
              >
                {v.version}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.min(versions.length - 1, i + 1))}
            disabled={currentIdx === versions.length - 1}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Next
            <ChevronRight size={12} />
          </button>
          <span className="text-xs text-muted-foreground">
            {currentIdx + 1} of {versions.length}
          </span>
        </div>

        {/* Current version detail */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="default">{current.version}</Badge>
            {current.date && (
              <span className="text-xs text-muted-foreground">{current.date}</span>
            )}
            {currentIdx === versions.length - 1 && (
              <Badge variant="success">Current</Badge>
            )}
          </div>

          {/* Show sections */}
          {current.sections && Object.entries(current.sections).map(([key, value]) => (
            <div key={key} className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {key.replace(/_/g, " ")}
              </h3>
              <div className="text-sm leading-6 text-foreground whitespace-pre-line">
                {value}
              </div>
            </div>
          ))}

          {/* What changed from previous version */}
          {prev && (
            <div className="mt-6 border-t border-border/40 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">
                Changed from {prev.version}
              </p>
              <p className="text-xs text-muted-foreground">
                Requirements version change from {prev.version} → {current.version} defines a new round boundary.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
