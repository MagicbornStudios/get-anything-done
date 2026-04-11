import Nav from "@/components/landing/nav/Nav";
import Hero from "@/components/landing/hero/Hero";
import HypothesisTracksSection from "@/components/landing/hypothesis-tracks/HypothesisTracksSection";
import Lineage from "@/components/landing/lineage/Lineage";
import Workflow from "@/components/landing/workflow/Workflow";
import Framework from "@/components/landing/framework/Framework";
import ExperimentLog from "@/components/landing/experiment-log/ExperimentLog";
import Projects from "@/components/landing/projects/Projects";
import RoundResults from "@/components/landing/round-results/RoundResults";
import Graphs from "@/components/landing/graphs/Graphs";
import Playable from "@/components/landing/playable/Playable";
import Requirements from "@/components/landing/requirements/Requirements";
import Catalog from "@/components/landing/catalog/Catalog";
import Templates from "@/components/landing/templates/Templates";
import RunIt from "@/components/landing/run-it/RunIt";
import Footer from "@/components/landing/Footer";

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      {/* PRIMARY: graph + playable archive adjacent — the research showcase */}
      <HypothesisTracksSection />
      <Playable />
      {/* CONTEXT: what the project is + how it works */}
      <ExperimentLog />
      <RoundResults />
      <Graphs />
      {/* BACKGROUND: lineage + methodology */}
      <Lineage />
      <Workflow />
      <Framework />
      <Projects />
      <Requirements />
      {/* CATALOG + ACTION */}
      <Catalog />
      <Templates />
      <RunIt />
      <Footer />
    </main>
  );
}
