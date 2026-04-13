import { CRITIQUES } from "./skeptic-shared";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import SkepticHero from "./SkepticHero";
import SkepticCrossCuttingSection from "./SkepticCrossCuttingSection";
import SkepticHypothesisCritiqueSection from "./SkepticHypothesisCritiqueSection";
import SkepticImprovementsSection from "./SkepticImprovementsSection";
import SkepticHowUsedSection from "./SkepticHowUsedSection";

export const metadata = {
  title: "Skeptic — devils-advocate critique of every hypothesis",
  description:
    "Every hypothesis we've claimed, held to its strongest critique. The credibility move is admitting what we don't know. Source: .planning/docs/SKEPTIC.md.",
};

export default function SkepticPage() {
  return (
    <MarketingShell>
      <Identified as="SkepticHero">
        <SkepticHero />
      </Identified>
      <Identified as="SkepticCrossCuttingSection">
        <SkepticCrossCuttingSection />
      </Identified>
      {CRITIQUES.map((c) => (
        <Identified key={c.id} as={`SkepticHypothesisCritiqueSection-${c.id}`}>
          <SkepticHypothesisCritiqueSection critique={c} />
        </Identified>
      ))}
      <Identified as="SkepticImprovementsSection">
        <SkepticImprovementsSection />
      </Identified>
      <Identified as="SkepticHowUsedSection">
        <SkepticHowUsedSection />
      </Identified>
    </MarketingShell>
  );
}
