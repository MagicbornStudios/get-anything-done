import type { EvalRunRecord } from "@/lib/eval-data";
import { Identified } from "@/components/devid/Identified";
import { ProjectRunsGrid } from "./ProjectRunsGrid";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function ProjectRunsSection({ runs }: { runs: EvalRunRecord[] }) {
  if (runs.length === 0) return null;
  return (
    <SiteSection>
      <Identified as="ProjectRuns">
        <SiteSectionHeading
          kicker="Runs"
          preset="section"
          title={`${runs.length} recorded run${runs.length === 1 ? "" : "s"}`}
        />
        <ProjectRunsGrid runs={runs} />
      </Identified>
    </SiteSection>
  );
}
