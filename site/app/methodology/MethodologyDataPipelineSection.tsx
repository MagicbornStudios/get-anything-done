import Link from "next/link";
import { Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DATA_STAGES } from "@/app/methodology/methodology-shared";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export function MethodologyDataPipelineSection() {
  return (
    <SiteSection>
      <Identified as="MethodologyDataPipelineSection">
      <Identified as="MethodologyDataPipelineHeading" register={false}>
        <SiteSectionHeading
          icon={Database}
          kicker="Data production pipeline"
          title="Structured → derived → insight"
        />
        <SiteProse size="md" className="mt-3">
        The eval framework&apos;s primary output is{" "}
        <strong className="text-foreground">structured data</strong>, not scores. Scores are one kind
        of derived number; the framework also produces rubrics, automated gate checks, derived metrics
        from trace events, and cross-run aggregates. The three stages below are how structured records
        become insights on this site.
        </SiteProse>
      </Identified>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {DATA_STAGES.map((stage) => (
          <Identified key={stage.stage} as={`MethodologyDataPipelineStage-${stage.stage}`}>
            <Card>
            <CardHeader>
              <div className="mb-2 inline-flex size-8 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-xs font-semibold text-accent">
                {stage.stage}
              </div>
              <CardTitle className="text-base">{stage.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              <p>{stage.body}</p>
              <p className="mt-3 font-mono text-[11px] text-foreground/70">
                Examples: {stage.examples}
              </p>
            </CardContent>
          </Card>
          </Identified>
        ))}
      </div>

      <Identified as="MethodologyDataPipelineObjectiveSubjective" className="mt-10 rounded-2xl border border-border/70 bg-card/40 p-6">
        <p className="text-xs uppercase tracking-wider text-accent">Objective vs subjective today</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Most of what we measure today is objective (counts, durations, coverage ratios, commit
          rhythm). A few load-bearing measurements are still subjective — human review is a single
          number set by a reviewer who &quot;felt like it was mid,&quot; and gate pass/fail depends on a
          human opening the built game and playing it. Phase 27 is the research methodology work that
          makes those measurements structured: human review gets a per-dimension rubric, gate checks
          get playwright automation, and derived metrics get exposed via{" "}
          <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">gad eval query</code> so we
          can ask cross-run questions like &quot;which runs used the forge room more than 3 times?&quot;
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The methodology discipline is captured in the{" "}
          <Link href="/skills/objective-eval-design" className="text-accent hover:underline">
            objective-eval-design
          </Link>{" "}
          skill: every measurement must answer a specific research question, expose its inputs, be
          comparable across runs, and be decomposable. A number that fails any of those tests
          isn&apos;t ready to publish. See{" "}
          <Link href="/standards" className="text-accent underline decoration-dotted">
            /standards
          </Link>{" "}
          for the Anthropic skills guide + agentskills.io convention that governs how individual skills
          are authored and evaluated.
        </p>
      </Identified>
      </Identified>
    </SiteSection>
  );
}
