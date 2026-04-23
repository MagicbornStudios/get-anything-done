"use client";

import { Identified } from "@portfolio/visual-context";
import { Badge } from "@/components/ui/badge";
import type { BugRecord } from "@/lib/eval-data";

export function ProjectBugRow({ bug: b }: { bug: BugRecord }) {
  return (
    <Identified
      as="ProjectBugRow"
      className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
    >
      <Badge
        variant={b.status === "resolved" ? "success" : b.status === "wontfix" ? "outline" : "danger"}
        className="shrink-0"
      >
        {b.status}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{b.title}</p>
        {b.version && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Found in {b.project}/{b.version}
          </p>
        )}
        {b.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{b.description}</p>
        )}
      </div>
    </Identified>
  );
}
