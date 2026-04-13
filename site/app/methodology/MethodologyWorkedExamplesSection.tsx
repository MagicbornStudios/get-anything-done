import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import type { EvalRunRecord } from "@/lib/eval-data";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function MethodologyWorkedExamplesSection({ worked }: { worked: EvalRunRecord[] }) {
  if (worked.length === 0) return null;
  return (
    <SiteSection>
      <Identified as="MethodologyWorkedExamplesSection">
      <Identified as="MethodologyWorkedExamplesHeading">
        <SiteSectionHeading kicker="Worked examples" title="Two runs, end to end" />
        <SiteProse size="md" className="mt-3">
        Two runs picked as         walkthroughs — one process-vs-reality divergence, one highest-scoring bare
        run. Click through for the full per-run view with the formula breakdown.
        </SiteProse>
      </Identified>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {worked.map((run) => (
          <Identified key={`${run.project}-${run.version}`} as={`MethodologyWorkedExampleCard-${run.project}-${run.version}`}>
            <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {run.project} · {run.version}
              </CardTitle>
              <CardDescription>
                composite {run.scores.composite?.toFixed(3) ?? "—"} · human{" "}
                {run.humanReview?.score?.toFixed(2) ?? "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-6 text-muted-foreground line-clamp-4">
                {run.humanReview?.notes ?? run.requirementCoverage?.gate_notes ?? ""}
              </p>
              <Link
                href={`/runs/${run.project}/${run.version}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
              >
                Full breakdown →
              </Link>
            </CardContent>
          </Card>
          </Identified>
        ))}
      </div>
      </Identified>
    </SiteSection>
  );
}
