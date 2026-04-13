import type { EvalRunRecord } from "@/lib/eval-data";
import { ProjectRunCard } from "@/app/projects/[id]/ProjectRunCard";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function ProjectRunsSection({ runs }: { runs: EvalRunRecord[] }) {
  if (runs.length === 0) return null;
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Runs"
        preset="section"
        title={`${runs.length} recorded run${runs.length === 1 ? "" : "s"}`}
      />
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {runs.map((run) => (
          <ProjectRunCard key={run.version} run={run} />
        ))}
      </div>
    </SiteSection>
  );
}
