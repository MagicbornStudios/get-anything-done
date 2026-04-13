"use client";

import { ProjectMarketAllProjectsBand } from "@/components/project-market/ProjectMarketAllProjectsBand";
import { ProjectMarketEmptyCatalog } from "@/components/project-market/ProjectMarketEmptyCatalog";
import { ProjectMarketFeaturedBand } from "@/components/project-market/ProjectMarketFeaturedBand";
import type { EnrichedProject } from "@/components/project-market/project-market-shared";

type Props = {
  featured: EnrichedProject[];
  other: EnrichedProject[];
};

export function ProjectMarketGrid({ featured, other }: Props) {
  if (featured.length === 0 && other.length === 0) {
    return <ProjectMarketEmptyCatalog />;
  }
  return (
    <div className="space-y-8">
      <ProjectMarketFeaturedBand projects={featured} />
      <ProjectMarketAllProjectsBand projects={other} />
    </div>
  );
}
