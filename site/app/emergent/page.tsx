import { MarketingShell } from "@/components/site";
import { PLAYABLE_INDEX } from "@/lib/eval-data";
import { EmergentComparisonSection } from "./EmergentComparisonSection";
import { EmergentCshSignalSection } from "./EmergentCshSignalSection";
import { EmergentHeroSection } from "./EmergentHeroSection";
import { EmergentLineageSection } from "./EmergentLineageSection";
import { emergentRunKey } from "./EmergentScoredRunRow";
import { emergentRuns } from "./emergent-runs";

export const metadata = {
  title: "Emergent — the compound-skills hypothesis",
  description:
    "Emergent is the eval workflow that inherits skills from previous runs, evolves them in place, and writes a CHANGELOG. This page rolls up every piece of evidence for the compound-skills hypothesis.",
};

export default function EmergentPage() {
  const runs = emergentRuns();
  const playableRuns = runs.filter((r) => PLAYABLE_INDEX[emergentRunKey(r)]);
  const scoredRuns = runs.filter(
    (r) =>
      r.humanReviewNormalized &&
      !r.humanReviewNormalized.is_empty &&
      r.humanReviewNormalized.aggregate_score != null,
  );

  const latestRun = runs[runs.length - 1];
  const latestScore = latestRun?.humanReviewNormalized?.aggregate_score ?? null;

  return (
    <MarketingShell>
      <EmergentHeroSection
        runsCount={runs.length}
        playableCount={playableRuns.length}
        scoredCount={scoredRuns.length}
        latestScore={latestScore}
      />
      <EmergentCshSignalSection scoredRuns={scoredRuns} />
      <EmergentLineageSection runs={runs} />
      <EmergentComparisonSection />
    </MarketingShell>
  );
}
