import { ArrowRight } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import RoundCard from "./RoundCard";
import { FUTURE_ROUNDS, pressureForRound } from "./roadmap-shared";

export default function RoadmapPlannedRoundsSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={ArrowRight}
        kicker="Planned rounds"
        kickerRowClassName="mb-8 gap-3"
      />
      <div className="space-y-6">
        {FUTURE_ROUNDS.map((r) => {
          const p = pressureForRound(r.round);
          return (
            <RoundCard
              key={r.round}
              round={r.round}
              title={r.title}
              body={r.body}
              pressure={p}
              status="planned"
            />
          );
        })}
      </div>
    </SiteSection>
  );
}
