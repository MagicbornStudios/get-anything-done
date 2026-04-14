import { Rocket } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { ROUND_SUMMARIES } from "@/lib/eval-data";
import RoundCard from "./RoundCard";
import { pressureForRound } from "./roadmap-shared";

export default function RoadmapCompletedRoundsSection() {
  return (
    <SiteSection cid="roadmap-completed-rounds-section-site-section">
      <SiteSectionHeading
        icon={Rocket}
        kicker="Completed rounds"
        kickerRowClassName="mb-8 gap-3"
      />
      <div className="space-y-6">
        {ROUND_SUMMARIES.map((r) => {
          const p = pressureForRound(r.round);
          return (
            <RoundCard
              key={r.round}
              round={r.round}
              title={r.title}
              body={r.body}
              pressure={p}
              status="completed"
            />
          );
        })}
      </div>
    </SiteSection>
  );
}

