import { MarketingShell } from "@/components/site";
import { PLAYABLE_INDEX } from "@/lib/eval-data";
import { bareRuns } from "./freedom-bare-runs";
import { FreedomBareMeansSection } from "./FreedomBareMeansSection";
import { FreedomHeroSection } from "./FreedomHeroSection";
import { FreedomRelatedSection } from "./FreedomRelatedSection";
import { FreedomScoresSection } from "./FreedomScoresSection";
import { FreedomSkepticSection } from "./FreedomSkepticSection";
import { freedomRunKey } from "./FreedomScoreRow";

export const metadata = {
  title: "Freedom Hypothesis — GAD",
  description:
    "Evidence rollup for the freedom hypothesis: for creative implementation tasks, less prescribed framework structure may lead to better output. Tracked via the bare eval workflow.",
};

export default function FreedomHypothesisPage() {
  const runs = bareRuns();
  const playable = runs.filter((r) => PLAYABLE_INDEX[freedomRunKey(r)]);
  const scoredCount = runs.filter(
    (r) =>
      (r.humanReviewNormalized &&
        !r.humanReviewNormalized.is_empty &&
        r.humanReviewNormalized.aggregate_score != null) ||
      typeof r.humanReview?.score === "number",
  ).length;
  const latest = runs[runs.length - 1];

  return (
    <MarketingShell>
      <FreedomHeroSection
        runs={runs}
        playableCount={playable.length}
        scoredCount={scoredCount}
        latest={latest}
      />
      <FreedomScoresSection runs={runs} />
      <FreedomBareMeansSection />
      <FreedomSkepticSection />
      <FreedomRelatedSection />
    </MarketingShell>
  );
}
