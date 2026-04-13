"use client";

import { ProjectCard } from "@/components/project-market/ProjectCard";
import type { EnrichedProject } from "@/components/project-market/project-market-shared";

export function ProjectMarketFeaturedBand({ projects }: { projects: EnrichedProject[] }) {
  if (projects.length === 0) return null;
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Featured projects
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}
