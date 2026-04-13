import { FrameworkIntro } from "@/components/landing/framework/FrameworkIntro";
import { FrameworkScoreWeights } from "@/components/landing/framework/FrameworkScoreWeights";
import { FrameworkWorkflowCards } from "@/components/landing/framework/FrameworkWorkflowCards";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export default function Framework() {
  return (
    <SiteSection id="framework" className="border-t border-border/60">
      <Identified as="LandingFramework">
      <Identified as="FrameworkIntro">
        <FrameworkIntro />
      </Identified>

      <Identified as="FrameworkWorkflowCards">
        <FrameworkWorkflowCards />
      </Identified>

      <Identified as="FrameworkScoreWeights">
        <FrameworkScoreWeights />
      </Identified>
      </Identified>
    </SiteSection>
  );
}
