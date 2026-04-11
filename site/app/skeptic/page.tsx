import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { CRITIQUES } from "./skeptic-shared";
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
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <SkepticHero />
      <SkepticCrossCuttingSection />
      {CRITIQUES.map((c) => (
        <SkepticHypothesisCritiqueSection key={c.id} critique={c} />
      ))}
      <SkepticImprovementsSection />
      <SkepticHowUsedSection />

      <Footer />
    </main>
  );
}
