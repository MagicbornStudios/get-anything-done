import { MethodologyAgentRuntimesSection } from "@/app/methodology/MethodologyAgentRuntimesSection";
import { MarketingShell } from "@/components/site";
import { MethodologyCompositeSection } from "@/app/methodology/MethodologyCompositeSection";
import { MethodologyDataPipelineSection } from "@/app/methodology/MethodologyDataPipelineSection";
import { MethodologyGateSection } from "@/app/methodology/MethodologyGateSection";
import { MethodologyHero } from "@/app/methodology/MethodologyHero";
import { MethodologyLineageSection } from "@/app/methodology/MethodologyLineageSection";
import { MethodologyTemplateMatrixSection } from "@/app/methodology/MethodologyTemplateMatrixSection";
import { MethodologyWorkedExamplesSection } from "@/app/methodology/MethodologyWorkedExamplesSection";
import { MethodologyCliReviewSection } from "@/app/methodology/MethodologyCliReviewSection";
import { MethodologyOpenQuestionsSection } from "@/app/methodology/MethodologyOpenQuestionsSection";
import { pickWorkedExamples } from "@/app/methodology/methodology-shared";

export const metadata = {
  title: "Methodology — how we score GAD evals",
  description:
    "Composite formulas, per-project weights, low-score caps, gate logic, data pipeline, and worked examples — the numbers behind the site.",
};

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <MarketingShell>
      <MethodologyHero />
      <MethodologyCompositeSection />
      <MethodologyGateSection />
      <MethodologyDataPipelineSection />
      <MethodologyAgentRuntimesSection />
      <MethodologyWorkedExamplesSection worked={worked} />
      <MethodologyLineageSection />
      <MethodologyTemplateMatrixSection />
      <MethodologyCliReviewSection />
      <MethodologyOpenQuestionsSection />
    </MarketingShell>
  );
}
