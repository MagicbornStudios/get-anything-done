import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { LineageContextRotSection } from "@/app/lineage/LineageContextRotSection";
import { LineageMeasurementSection } from "@/app/lineage/LineageMeasurementSection";
import { LineagePageHero } from "@/app/lineage/LineagePageHero";
import { LineagePredecessorsSection } from "@/app/lineage/LineagePredecessorsSection";

export const metadata = {
  title: "Lineage — GSD, RepoPlanner, GAD",
  description:
    "The problem of context rot in agent-driven development, the upstream Get Shit Done framework, the RepoPlanner precursor that formalized the Ralph Wiggum loop, and how GAD builds on both and adds measurement.",
};

export default function LineagePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <LineagePageHero />
      <LineageContextRotSection />
      <LineagePredecessorsSection />
      <LineageMeasurementSection />
      <Footer />
    </main>
  );
}
