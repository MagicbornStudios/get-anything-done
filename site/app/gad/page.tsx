import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import { GadCatalogJumpSection } from "./GadCatalogJumpSection";
import { GadCoreConceptsSection } from "./GadCoreConceptsSection";
import { GadHeroSection } from "./GadHeroSection";
import { GadSkillBootstrapSection } from "./GadSkillBootstrapSection";

export const metadata = {
  title: "GAD framework - overview + catalog",
  description:
    "The get-anything-done framework at a glance: what it is, how the loop works, every official skill, every subagent, and every template. The canonical entry point to exploring the framework.",
};

export default function GADOverviewPage() {
  return (
    <MarketingShell>
      <Identified as="GadHeroSection">
        <GadHeroSection />
      </Identified>
      <Identified as="GadCoreConceptsSection">
        <GadCoreConceptsSection />
      </Identified>
      <Identified as="GadSkillBootstrapSection">
        <GadSkillBootstrapSection />
      </Identified>
      <Identified as="GadCatalogJumpSection">
        <GadCatalogJumpSection />
      </Identified>
    </MarketingShell>
  );
}
