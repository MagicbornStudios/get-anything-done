import { MethodologyAgentRuntimesSection } from "@/app/methodology/MethodologyAgentRuntimesSection";
import { MarketingShell } from "@/components/site";
import { MethodologyDataPipelineSection } from "@/app/methodology/MethodologyDataPipelineSection";
import { MethodologyGateSection } from "@/app/methodology/MethodologyGateSection";
import { MethodologyTemplateMatrixSection } from "@/app/methodology/MethodologyTemplateMatrixSection";
import { MethodologyWorkedExamplesSection } from "@/app/methodology/MethodologyWorkedExamplesSection";
import { MethodologyCliReviewSection } from "@/app/methodology/MethodologyCliReviewSection";
import { MethodologyOpenQuestionsSection } from "@/app/methodology/MethodologyOpenQuestionsSection";
import { pickWorkedExamples } from "@/app/methodology/methodology-shared";

export const metadata = {
  title: "Methodology — how we score GAD evals",
  description:
    "Low-score caps, gate logic, data pipeline, and worked examples — the numbers behind the site.",
};

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <MarketingShell>
      <MethodologyGateSection />
      <MethodologyDataPipelineSection />
      <MethodologyAgentRuntimesSection />
      <MethodologyWorkedExamplesSection worked={worked} />
      <MethodologyTemplateMatrixSection />
      <MethodologyCliReviewSection />
      <MethodologyOpenQuestionsSection />
    </MarketingShell>
  );
}
