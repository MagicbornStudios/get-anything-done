import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { ALL_PHASES } from "@/lib/eval-data";
import { PhasesHero } from "@/app/phases/PhasesHero";
import { PhasesListSection } from "@/app/phases/PhasesListSection";

export const metadata = {
  title: "Phases — GAD",
  description:
    "Every phase in .planning/ROADMAP.xml rendered with task counts, status, and deep-links to individual tasks.",
};

export default function PhasesPage() {
  const phases = ALL_PHASES.slice().sort((a, b) => {
    const an = parseFloat(a.id);
    const bn = parseFloat(b.id);
    return an - bn;
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <PhasesHero phases={phases} />
      <PhasesListSection phases={phases} />

      <Footer />
    </main>
  );
}
