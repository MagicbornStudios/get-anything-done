import { TrendingUp } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import type { EvalRunRecord } from "@/lib/eval-data";
import { EmergentScoredRunRow, emergentRunKey } from "./EmergentScoredRunRow";

type EmergentCshSignalSectionProps = {
  scoredRuns: EvalRunRecord[];
};

export function EmergentCshSignalSection({ scoredRuns }: EmergentCshSignalSectionProps) {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={TrendingUp}
        kicker="CSH signal — human review across rounds"
        kickerRowClassName="mb-6 gap-3"
      />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        If skills are compounding, the line goes up-and-to-the-right across rounds. The sixth rubric
        dimension,{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">skill_inheritance_effectiveness</code>, is
        the CSH-specific signal (weight 0.20).
      </p>
      <div className="space-y-3">
        {scoredRuns.map((r) => (
          <EmergentScoredRunRow key={emergentRunKey(r)} run={r} />
        ))}
      </div>
      {scoredRuns.length < 2 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Only {scoredRuns.length} scored run so far — not enough signal to claim the hypothesis is
          holding OR failing. Round 5 will be the first real trial against v5 requirements.
        </p>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground">
        <strong className="text-foreground">Data provenance:</strong> scores read from{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">
          EVAL_RUNS[n].humanReviewNormalized.aggregate_score
        </code>
        , computed at prebuild from each run&apos;s rubric submission via{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">gad eval review --rubric</code>.
      </p>
    </SiteSection>
  );
}
