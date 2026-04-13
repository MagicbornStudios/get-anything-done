import { Calculator } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { MethodologyCompositeWeightsCatalog } from "./MethodologyCompositeWeightsCatalog";

export function MethodologyCompositeSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="MethodologyCompositeSection">
      <Identified as="MethodologyCompositeHeading">
        <SiteSectionHeading
          icon={Calculator}
          kicker="Composite formula"
          title="The weighted sum"
        />
        <SiteProse size="md" className="mt-3">
        The composite score is a plain weighted sum of dimension scores. Every dimension is
        normalised to 0.0 – 1.0 before the multiply. The weights are project-specific and committed to{" "}
        <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">
          evals/&lt;project&gt;/gad.json
        </code>
        .
        </SiteProse>
      </Identified>

      <Identified as="MethodologyCompositeFormula" className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-6 md:p-8">
        <p className="font-mono text-sm text-muted-foreground">composite =</p>
        <p className="mt-2 font-mono text-base leading-8 text-foreground">
          Σ<sub>dimensions</sub>
          <span className="mx-2">(</span>
          <span className="text-accent">
            score<sub>i</sub>
          </span>
          <span className="mx-2">×</span>
          <span className="text-emerald-400">
            weight<sub>i</sub>
          </span>
          <span className="mx-2">)</span>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Weights sum to 1.0 across a project&apos;s dimensions. A run can max out at 1.0; the minimum
          is 0.0 (modulo the low-score cap below).
        </p>
      </Identified>

      <Identified as="MethodologyCompositeWeightsIntro">
        <h3 className="mt-14 text-2xl font-semibold tracking-tight">Weights per eval project</h3>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Different eval projects weight different dimensions. A tooling eval might care most about
          time efficiency; an implementation eval weighs human review at 30% to prevent process metrics
          from rescuing a broken artifact.
        </p>
      </Identified>

      <MethodologyCompositeWeightsCatalog />
      </Identified>
    </SiteSection>
  );
}
