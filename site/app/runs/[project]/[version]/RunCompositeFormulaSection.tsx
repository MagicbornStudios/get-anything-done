import type { EvalRunRecord } from "@/lib/eval-data";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { formatNum } from "@/app/runs/[project]/[version]/run-detail-shared";

type ContributionRow = {
  dimension: string;
  weight: number;
  value: number;
  contribution: number;
};

export function RunCompositeFormulaSection({
  run,
  composite,
  contributions,
  weightedSum,
}: {
  run: EvalRunRecord;
  composite: number;
  contributions: ContributionRow[];
  weightedSum: number;
}) {
  return (
    <SiteSection>
      <Identified as="RunCompositeFormulaHeader">
        <SiteSectionHeading
          kicker="Composite formula"
          title={<>How {formatNum(composite)} was calculated</>}
        />
        <SiteProse size="md" className="mt-3">
          The composite score is a weighted sum of the dimensions above. Weights come from{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">evals/{run.project}/gad.json</code>
          . Contribution = score × weight; dimensions sorted by contribution so you can see what
          actually moved the needle.
        </SiteProse>
      </Identified>

      <Identified as="RunCompositeFormulaTable" className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/40">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Dimension</th>
                <th className="px-5 py-3 font-medium tabular-nums">Weight</th>
                <th className="px-5 py-3 font-medium tabular-nums">Score</th>
                <th className="px-5 py-3 font-medium tabular-nums">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c, idx) => {
                const pctOfComposite = weightedSum > 0 ? (c.contribution / weightedSum) * 100 : 0;
                return (
                  <Identified
                    key={c.dimension}
                    as={`RunCompositeFormulaRow-${c.dimension.replace(/[^a-zA-Z0-9]+/g, "-")}`}
                    tag="tr"
                    className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                  >
                    <td className="px-5 py-3 font-mono text-[11px] text-foreground">{c.dimension}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {c.weight.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {c.value.toFixed(3)}
                    </td>
                    <td className="px-5 py-3 tabular-nums">
                      <span className="font-semibold text-accent">{c.contribution.toFixed(4)}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        ({pctOfComposite.toFixed(0)}%)
                      </span>
                    </td>
                  </Identified>
                );
              })}
              <Identified as="RunCompositeFormulaTotals" tag="tr" className="border-t border-border/70 bg-background/40">
                <td className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Weighted sum
                </td>
                <td className="px-5 py-4 tabular-nums text-muted-foreground">
                  {contributions.reduce((acc, c) => acc + c.weight, 0).toFixed(2)}
                </td>
                <td />
                <td className="px-5 py-4 tabular-nums">
                  <span className="text-lg font-bold gradient-text">{weightedSum.toFixed(4)}</span>
                </td>
              </Identified>
            </tbody>
          </table>
      </Identified>
        {Math.abs(weightedSum - composite) > 0.005 && (
          <Identified as="RunCompositeFormulaMismatchNote" tag="p" className="mt-4 max-w-2xl rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300">
            <strong>Note:</strong> The weighted sum above ({weightedSum.toFixed(4)}) doesn&apos;t
            exactly match the stored composite ({composite.toFixed(4)}). The difference is usually the
            v3 low-score cap (composite &lt; 0.20 → 0.40, composite &lt; 0.10 → 0.25) or a run with an
            older scoring pass.
          </Identified>
        )}
    </SiteSection>
  );
}
