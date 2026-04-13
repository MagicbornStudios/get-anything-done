import { MethodologyAgentRuntimesSection } from "@/app/methodology/MethodologyAgentRuntimesSection";
import { Identified } from "@/components/devid/Identified";
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
      <Identified as="MethodologyPage-Hero">
        <MethodologyHero />
      </Identified>
      <Identified as="MethodologyPage-Composite">
        <MethodologyCompositeSection />
      </Identified>
      <Identified as="MethodologyPage-Gate">
        <MethodologyGateSection />
      </Identified>
      <MethodologyTraceSection />
      <Identified as="MethodologyPage-DataPipeline">
        <MethodologyDataPipelineSection />
      </Identified>
      <Identified as="MethodologyPage-AgentRuntimes">
        <MethodologyAgentRuntimesSection />
      </Identified>
      <Identified as="MethodologyPage-WorkedExamples">
        <MethodologyWorkedExamplesSection worked={worked} />
      </Identified>
      <Identified as="MethodologyPage-Lineage">
        <MethodologyLineageSection />
      </Identified>
      <Identified as="MethodologyPage-TemplateMatrix">
        <MethodologyTemplateMatrixSection />
      </Identified>
      <Identified as="MethodologyPage-CliReview">
        <MethodologyCliReviewSection />
      </Identified>
      <Identified as="MethodologyPage-OpenQuestions">
        <MethodologyOpenQuestionsSection />
      </Identified>
    </MarketingShell>
  );
}
