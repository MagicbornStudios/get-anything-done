import { MarketingShell } from "@/components/site";
import { MethodologyCliReviewSection } from "@/app/methodology/MethodologyCliReviewSection";
import { MethodologyOpenQuestionsSection } from "@/app/methodology/MethodologyOpenQuestionsSection";

export const metadata = {
  title: "Methodology — how we score GAD evals",
  description:
    "Evaluation review workflow and open questions — the numbers behind the site.",
};

export default function MethodologyPage() {
  return (
    <MarketingShell>
      <MethodologyCliReviewSection />
      <MethodologyOpenQuestionsSection />
    </MarketingShell>
  );
}
