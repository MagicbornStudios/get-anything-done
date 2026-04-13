"use client";

import { Identified } from "@/components/devid/Identified";
import { ProjectCard } from "@/components/project-market/ProjectCard";
import type { EnrichedProject } from "@/components/project-market/project-market-shared";

type Props = {
  featured: EnrichedProject[];
  other: EnrichedProject[];
};

export function ProjectMarketGrid({ featured, other }: Props) {
  return (
    <div className="space-y-8">
      {featured.length > 0 && (
        <Identified as="ProjectMarketFeaturedBlock">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Featured projects
          </h2>
          <Identified as="ProjectMarketFeaturedGrid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </Identified>
        </Identified>
      )}

      {other.length > 0 && (
        <Identified as="ProjectMarketAllProjectsBlock">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            All projects
            <span className="ml-2 text-[10px] font-normal text-muted-foreground/70">
              {other.length} project{other.length !== 1 ? "s" : ""}
            </span>
          </h2>
          <Identified as="ProjectMarketAllProjectsGrid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {other.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </Identified>
        </Identified>
      )}

      {featured.length === 0 && other.length === 0 && (
        <Identified as="ProjectMarketEmptyState" className="py-12 text-center">
          <p className="text-lg font-semibold text-muted-foreground">No projects match your filters</p>
          <p className="mt-2 text-sm text-muted-foreground/70">Try adjusting your search or filters.</p>
        </Identified>
      )}
    </div>
  );
}
