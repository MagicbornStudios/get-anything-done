import { MarketingShell } from "@/components/site";
import { MethodologyTemplateMatrixSection } from "@/app/methodology/MethodologyTemplateMatrixSection";
import { MethodologyWorkedExamplesSection } from "@/app/methodology/MethodologyWorkedExamplesSection";
import { MethodologyCliReviewSection } from "@/app/methodology/MethodologyCliReviewSection";
import { MethodologyOpenQuestionsSection } from "@/app/methodology/MethodologyOpenQuestionsSection";
import { pickWorkedExamples } from "@/app/methodology/methodology-shared";

export const metadata = {
  title: "Methodology — how we score GAD evals",
  description:
    "Worked examples and templates — the numbers behind the site.",
};

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <MarketingShell>
      <MethodologyWorkedExamplesSection worked={worked} />
      <MethodologyTemplateMatrixSection />
      <MethodologyCliReviewSection />
      <MethodologyOpenQuestionsSection />
    </MarketingShell>
  );
}
