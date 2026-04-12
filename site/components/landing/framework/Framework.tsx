import { FrameworkIntro } from "@/components/landing/framework/FrameworkIntro";
import { FrameworkScoreWeights } from "@/components/landing/framework/FrameworkScoreWeights";
import { FrameworkWorkflowCards } from "@/components/landing/framework/FrameworkWorkflowCards";
import { SiteSection } from "@/components/site";

export default function Framework() {
  return (
    <SiteSection id="framework" className="border-t border-border/60">
      <FrameworkIntro />

      <FrameworkWorkflowCards />

      <FrameworkScoreWeights />
    </SiteSection>
  );
}
