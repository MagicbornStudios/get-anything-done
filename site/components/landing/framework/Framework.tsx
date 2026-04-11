import { FrameworkIntro } from "@/components/landing/framework/FrameworkIntro";
import { FrameworkScoreWeights } from "@/components/landing/framework/FrameworkScoreWeights";
import { FrameworkWorkflowCards } from "@/components/landing/framework/FrameworkWorkflowCards";

export default function Framework() {
  return (
    <section id="framework" className="border-t border-border/60">
      <div className="section-shell">
        <FrameworkIntro />

        <FrameworkWorkflowCards />

        <FrameworkScoreWeights />
      </div>
    </section>
  );
}
