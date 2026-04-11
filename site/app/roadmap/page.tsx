import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { buildTrackData } from "./roadmap-shared";
import RoadmapHeroSection from "./RoadmapHeroSection";
import RoadmapHypothesisTracksSection from "./RoadmapHypothesisTracksSection";
import RoadmapPressureSection from "./RoadmapPressureSection";
import RoadmapCompletedRoundsSection from "./RoadmapCompletedRoundsSection";
import RoadmapPlannedRoundsSection from "./RoadmapPlannedRoundsSection";

export const metadata = {
  title: "Roadmap — GAD",
  description:
    "Round-by-round timeline of every eval round, the requirements version it targeted, outcomes, honest shortcomings, and mitigations. Pressure progression across rounds.",
};

export default function RoadmapPage() {
  const trackData = buildTrackData();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <RoadmapHeroSection />
      <RoadmapHypothesisTracksSection trackData={trackData} />
      <RoadmapPressureSection />
      <RoadmapCompletedRoundsSection />
      <RoadmapPlannedRoundsSection />

      <Footer />
    </main>
  );
}
