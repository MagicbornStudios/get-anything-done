import StandardsHeroSection from "./StandardsHeroSection";
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
      <StandardsHeroSection />
      <StandardsReferencesSection />
      <StandardsProgressiveDisclosureSection />
      <StandardsDiscoverySection />
      <StandardsNameCollisionSection />
      <StandardsEvaluationMethodologySection />
      <StandardsTestingLayersSection />
    </MarketingShell>
  );
}
