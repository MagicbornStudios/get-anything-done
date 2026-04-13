import type { EvalRunRecord } from "@/lib/eval-data";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { RunScoreBar } from "@/components/run-detail/RunScoreBar";
import { formatNum, type RunScores } from "@/lib/run-detail-shared";

export function RunDimensionScoresSection({
  run,
  dimensionScores,
}: {
  run: EvalRunRecord;
  dimensionScores: Array<{ key: keyof RunScores; label: string; value: number | undefined }>;
}) {
  return (
    <SiteSection>
      <Identified as="RunDimensionScores">
      <Identified as="RunDimensionScoresHeader">
        <SiteSectionHeading kicker="Dimension scores" title="Where the composite came from" />
        <SiteProse size="md" className="mt-3 max-w-2xl">
          Each dimension is scored 0.0 – 1.0 and combined using the weights in{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">evals/{run.project}/gad.json</code>
          . Human review dominates on purpose — process metrics alone can&apos;t rescue a broken run.
        </SiteProse>
      </Identified>

      <Identified as="RunDimensionScoresTable" className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Dimension</th>
                <th className="px-5 py-3 font-medium tabular-nums">Score</th>
                <th className="px-5 py-3">Bar</th>
              </tr>
            </thead>
            <tbody>
              {dimensionScores.map((row, idx) => (
                <Identified
                  key={row.key}
                  as="RunDimensionScoreRow"
                  tag="tr"
                  className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                >
                  <td className="px-5 py-3 font-medium text-foreground">{row.label}</td>
                  <td className="px-5 py-3 tabular-nums text-accent">{formatNum(row.value, 3)}</td>
                  <td className="px-5 py-3">
                    <div className="max-w-xs">
                      <RunScoreBar value={row.value ?? 0} />
                    </div>
                  </td>
                </Identified>
              ))}
            </tbody>
          </table>
      </Identified>
      </Identified>
    </SiteSection>
  );
}
