import { TrendingUp } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import type { EvalRunRecord } from "@/lib/eval-data";
import { FreedomScoreRow, freedomRunKey } from "./FreedomScoreRow";

type FreedomScoresSectionProps = {
  runs: EvalRunRecord[];
};

export function FreedomScoresSection({ runs }: FreedomScoresSectionProps) {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={TrendingUp}
        kicker="Human review across rounds"
        kickerRowClassName="mb-6 gap-3"
        iconClassName="text-emerald-400"
      />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Each row is one bare run. If the freedom hypothesis is real, the line goes up-and-to-the-right.
        So far it does — but{" "}
        <strong className="text-foreground">n=5 is not a curve</strong>, and each run targeted a harder
        requirements version, so the improvement may be the requirements getting clearer rather than
        freedom itself paying off.
      </p>
      <div className="space-y-3">
        {runs.map((r) => (
          <FreedomScoreRow key={freedomRunKey(r)} run={r} />
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        <strong className="text-foreground">Data provenance:</strong> scores from{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">
          EVAL_RUNS[].humanReviewNormalized.aggregate_score
        </code>{" "}
        or legacy{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">humanReview.score</code> for runs predating
        the rubric.
      </p>
    </SiteSection>
  );
}
