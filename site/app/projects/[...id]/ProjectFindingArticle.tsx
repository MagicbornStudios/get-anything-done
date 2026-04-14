"use client";

import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import type { Finding } from "@/lib/catalog.generated";

export function ProjectFindingArticle({ finding: f }: { finding: Finding }) {
  return (
    <Identified
      as="ProjectFindingArticle"
      tag="article"
      className="rounded-2xl border border-border/70 bg-card/40 p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        {f.round && <Badge variant="outline">Evolution {f.round}</Badge>}
        {f.gadVersion && (
          <Badge variant="outline" className="font-mono text-[10px]">
            GAD v{f.gadVersion}
          </Badge>
        )}
        {f.date && (
          <span className="text-[11px] text-muted-foreground">{f.date}</span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-foreground">{f.title}</h3>
      {f.summary && (
        <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
      )}
      <div
        className="prose prose-invert prose-sm mt-4 max-w-none prose-headings:text-foreground prose-a:text-accent"
        dangerouslySetInnerHTML={{ __html: f.bodyHtml }}
      />
    </Identified>
  );
}
