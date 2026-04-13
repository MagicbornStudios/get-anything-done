import StandardsHeroSection from "./StandardsHeroSection";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import StandardsReferencesSection from "./StandardsReferencesSection";
import StandardsProgressiveDisclosureSection from "./StandardsProgressiveDisclosureSection";
import StandardsDiscoverySection from "./StandardsDiscoverySection";
import StandardsNameCollisionSection from "./StandardsNameCollisionSection";
import StandardsEvaluationMethodologySection from "./StandardsEvaluationMethodologySection";
import StandardsTestingLayersSection from "./StandardsTestingLayersSection";

export const metadata = {
  title: "Standards — GAD",
  description:
    "The open standards GAD cites and conforms to: the Anthropic skills guide and the agentskills.io specification. Every skill-related page on this site links back here.",
};

export default function StandardsPage() {
  return (
    <MarketingShell>
      <Identified as="StandardsHeroSection">
        <StandardsHeroSection />
      </Identified>
      <Identified as="StandardsReferencesSection">
        <StandardsReferencesSection />
      </Identified>
      <Identified as="StandardsProgressiveDisclosureSection">
        <StandardsProgressiveDisclosureSection />
      </Identified>
      <Identified as="StandardsDiscoverySection">
        <StandardsDiscoverySection />
      </Identified>
      <Identified as="StandardsNameCollisionSection">
        <StandardsNameCollisionSection />
      </Identified>
      <Identified as="StandardsEvaluationMethodologySection">
        <StandardsEvaluationMethodologySection />
      </Identified>
      <Identified as="StandardsTestingLayersSection">
        <StandardsTestingLayersSection />
      </Identified>
    </MarketingShell>
  );
}
