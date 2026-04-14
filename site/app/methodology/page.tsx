import { MethodologyAgentRuntimesSection } from "@/app/methodology/MethodologyAgentRuntimesSection";
import { MarketingShell } from "@/components/site";
import { MethodologyDataPipelineSection } from "@/app/methodology/MethodologyDataPipelineSection";
import { MethodologyGateSection } from "@/app/methodology/MethodologyGateSection";
import { MethodologyHero } from "@/app/methodology/MethodologyHero";
import { MethodologyTemplateMatrixSection } from "@/app/methodology/MethodologyTemplateMatrixSection";
import { MethodologyWorkedExamplesSection } from "@/app/methodology/MethodologyWorkedExamplesSection";
import { MethodologyCliReviewSection } from "@/app/methodology/MethodologyCliReviewSection";
import { MethodologyOpenQuestionsSection } from "@/app/methodology/MethodologyOpenQuestionsSection";
import { pickWorkedExamples } from "@/app/methodology/methodology-shared";
import { PageIdentified } from "@/components/devid/PageIdentified";

export const metadata = {
  title: "Methodology — how we score GAD evals",
  description:
    "Low-score caps, gate logic, data pipeline, and worked examples — the numbers behind the site.",
};

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <MarketingShell>
      <PageIdentified as="MethodologyPageIntro">
        <MethodologyHero />
      </PageIdentified>
      <PageIdentified as="MethodologyPageGateSection">
        <MethodologyGateSection />
      </PageIdentified>
      <PageIdentified as="MethodologyPageDataPipelineSection">
        <MethodologyDataPipelineSection />
      </PageIdentified>
      <PageIdentified as="MethodologyPageAgentRuntimesSection">
        <MethodologyAgentRuntimesSection />
      </PageIdentified>
      <PageIdentified as="MethodologyPageWorkedExamplesSection">
        <MethodologyWorkedExamplesSection worked={worked} />
      </PageIdentified>
      <PageIdentified as="MethodologyPageTemplateMatrixSection">
        <MethodologyTemplateMatrixSection />
      </PageIdentified>
      <PageIdentified as="MethodologyPageCliReviewSection">
        <MethodologyCliReviewSection />
      </PageIdentified>
      <PageIdentified as="MethodologyPageOpenQuestionsSection">
        <MethodologyOpenQuestionsSection />
      </PageIdentified>
    </MarketingShell>
  );
}
