import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { MethodologyAgentRuntimesSection } from "@/app/methodology/MethodologyAgentRuntimesSection";
import { MethodologyCompositeSection } from "@/app/methodology/MethodologyCompositeSection";
import { MethodologyDataPipelineSection } from "@/app/methodology/MethodologyDataPipelineSection";
import { MethodologyGateSection } from "@/app/methodology/MethodologyGateSection";
import { MethodologyHero } from "@/app/methodology/MethodologyHero";
import { MethodologyLineageSection } from "@/app/methodology/MethodologyLineageSection";
import { MethodologyTemplateMatrixSection } from "@/app/methodology/MethodologyTemplateMatrixSection";
import { MethodologyTraceSection } from "@/app/methodology/MethodologyTraceSection";
import { MethodologyWorkedExamplesSection } from "@/app/methodology/MethodologyWorkedExamplesSection";
import { pickWorkedExamples } from "@/app/methodology/methodology-shared";

export const metadata = {
  title: "Methodology — how we score and trace GAD evals",
  description:
    "Every formula, every weight, every low-score cap, and the current trace schema explained end-to-end. Plus the known gaps in today's tracing.",
};

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <MethodologyHero />
      <MethodologyCompositeSection />
      <MethodologyGateSection />
      <MethodologyTraceSection />
      <MethodologyDataPipelineSection />
      <MethodologyAgentRuntimesSection />
      <MethodologyWorkedExamplesSection worked={worked} />
      <MethodologyLineageSection />
      <MethodologyTemplateMatrixSection />
      <Footer />
    </main>
  );
}
