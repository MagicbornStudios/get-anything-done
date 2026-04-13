import RubricRadar, { type RubricDimension } from "@/components/charts/RubricRadar";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import type { EvalProjectMeta, EvalRunRecord } from "@/lib/eval-data";

export function RunRubricSection({
  run,
  rubricDimensions,
  rubricDef,
  rubric,
}: {
  run: EvalRunRecord;
  rubricDimensions: RubricDimension[];
  rubricDef: NonNullable<EvalProjectMeta["humanReviewRubric"]>;
  rubric: EvalRunRecord["humanReviewNormalized"];
}) {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        kicker="Human review rubric"
        title="Where the reviewer scored this run best and worst"
      />
      <Identified as="RunRubricProse">
        <SiteProse size="md" className="mt-3">
          Each axis is a rubric dimension from{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">evals/{run.project}/gad.json</code> →{" "}
          <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">human_review_rubric</code>. The
          filled polygon shows the reviewer&apos;s per-dimension scores, 0.0 at center to 1.0 at the edge.
          The aggregate score (
          <strong className="text-foreground">{rubric?.aggregate_score?.toFixed(3) ?? "—"}</strong>) is the
          weighted sum of the dimensions using weights declared in the rubric.
        </SiteProse>
      </Identified>

      <Identified as="RunRubricBody" className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <Identified as="RunRubricRadar" className="rounded-2xl border border-border/70 bg-background/40 p-6">
            <RubricRadar dimensions={rubricDimensions} workflow={run.workflow} size={360} />
          </Identified>
          <Identified as="RunRubricTableWrap" className="rounded-2xl border border-border/70 bg-card/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Dimension</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Score</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Weight</th>
                </tr>
              </thead>
              <tbody>
                {rubricDef.dimensions.map((d, idx) => {
                  const dimScore = rubric?.dimensions[d.key]?.score;
                  const dimNotes = rubric?.dimensions[d.key]?.notes;
                  return (
                    <tr
                      key={d.key}
                      className={idx % 2 === 0 ? "bg-transparent" : "bg-background/30"}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{d.label}</p>
                        {dimNotes && (
                          <p className="mt-1 text-xs text-muted-foreground">{dimNotes}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-accent">
                        {typeof dimScore === "number" ? dimScore.toFixed(2) : "—"}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">
                        {d.weight.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Identified>
      </Identified>
    </SiteSection>
  );
}
