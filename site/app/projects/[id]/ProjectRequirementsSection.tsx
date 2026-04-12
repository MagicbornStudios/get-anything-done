"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";
import { SiteSection, SiteSectionHeading } from "@/components/site";

type RequirementsVersion = (typeof REQUIREMENTS_HISTORY)[number];

export function ProjectRequirementsSection({ projectId }: { projectId: string }) {
  const versions = REQUIREMENTS_HISTORY;
  const [currentIdx, setCurrentIdx] = useState(versions.length - 1);

  if (versions.length === 0) return null;

  const current = versions[currentIdx];
  const prev = currentIdx > 0 ? versions[currentIdx - 1] : null;

  return (
    <SiteSection className="border-b-0 border-t border-border/60">
      <SiteSectionHeading
        kicker="Requirements history"
        preset="section"
        titleClassName="text-2xl font-semibold tracking-tight"
        title={`${versions.length} version${versions.length !== 1 ? "s" : ""} — each change triggers a new round`}
      />

      {/* Version pagination */}
      <div className="mt-6 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="h-auto gap-1 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            <ChevronLeft size={12} aria-hidden />
            Prev
          </Button>
          <div className="flex max-w-full flex-wrap gap-1.5">
            {versions.map((v, i) => (
              <Button
                key={v.version}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentIdx(i)}
                className={cn(
                  "h-8 min-w-8 shrink-0 rounded-full px-2 text-xs font-semibold shadow-none",
                  i === currentIdx
                    ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground"
                    : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60"
                )}
              >
                {v.version}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentIdx((i) => Math.min(versions.length - 1, i + 1))}
            disabled={currentIdx === versions.length - 1}
            className="h-auto gap-1 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Next
            <ChevronRight size={12} aria-hidden />
          </Button>
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
    </SiteSection>
  );
}
