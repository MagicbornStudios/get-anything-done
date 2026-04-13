import { MethodologyAgentRuntimesSection } from "@/app/methodology/MethodologyAgentRuntimesSection";
import { MarketingShell } from "@/components/site";
import { MethodologyCompositeSection } from "@/app/methodology/MethodologyCompositeSection";
import { MethodologyDataPipelineSection } from "@/app/methodology/MethodologyDataPipelineSection";
import { MethodologyGateSection } from "@/app/methodology/MethodologyGateSection";
import { MethodologyHero } from "@/app/methodology/MethodologyHero";
import { MethodologyLineageSection } from "@/app/methodology/MethodologyLineageSection";
import { MethodologyTemplateMatrixSection } from "@/app/methodology/MethodologyTemplateMatrixSection";
import { MethodologyTraceSection } from "@/app/methodology/MethodologyTraceSection";
import { MethodologyWorkedExamplesSection } from "@/app/methodology/MethodologyWorkedExamplesSection";
import { MethodologyCliReviewSection } from "@/app/methodology/MethodologyCliReviewSection";
import { MethodologyOpenQuestionsSection } from "@/app/methodology/MethodologyOpenQuestionsSection";
import { pickWorkedExamples } from "@/app/methodology/methodology-shared";

export const metadata = {
  title: "Methodology — how we score and trace GAD evals",
  description:
    "Every formula, every weight, every low-score cap, and the current trace schema explained end-to-end. Plus the known gaps in today's tracing.",
};

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <MarketingShell>
      <MethodologyHero />
      <MethodologyCompositeSection />
      <MethodologyGateSection />
      <MethodologyTraceSection />
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
