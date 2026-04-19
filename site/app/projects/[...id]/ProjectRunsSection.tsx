import type { EvalRunRecord } from "@/lib/eval-data";
import { ProjectRunsGrid } from "./ProjectRunsGrid";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function ProjectRunsSection({ runs }: { runs: EvalRunRecord[] }) {
  if (runs.length === 0) return null;
  // Task 44-16: SiteSection cid alone identifies this surface.
  return (
    <SiteSection cid="project-runs-section-site-section">
      <SiteSectionHeading
        kicker="Runs"
        preset="section"
        title={`${runs.length} recorded run${runs.length === 1 ? "" : "s"}`}
      />
      <ProjectRunsGrid runs={runs} />
    </SiteSection>
  );
}
