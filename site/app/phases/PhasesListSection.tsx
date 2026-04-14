import { GitBranch } from "lucide-react";
import type { PhaseRecord } from "@/lib/eval-data";
import { PhaseCard } from "@/app/phases/PhaseCard";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function PhasesListSection({ phases }: { phases: PhaseRecord[] }) {
  return (
    <SiteSection cid="phases-list-section-site-section" tone="muted">
      <SiteSectionHeading icon={GitBranch} kicker="All phases" kickerRowClassName="mb-6 gap-3" />
      <div className="space-y-4">
        {phases.map((p) => (
          <PhaseCard key={p.id} phase={p} />
        ))}
      </div>
    </SiteSection>
  );
}

