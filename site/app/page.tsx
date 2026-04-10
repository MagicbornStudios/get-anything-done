import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import HypothesisTracksSection from "@/components/landing/HypothesisTracksSection";
import WhatItIs from "@/components/landing/WhatItIs";
import Lineage from "@/components/landing/Lineage";
import Workflow from "@/components/landing/Workflow";
import Framework from "@/components/landing/Framework";
import Rounds from "@/components/landing/Rounds";
import Projects from "@/components/landing/Projects";
import Results from "@/components/landing/Results";
import Graphs from "@/components/landing/Graphs";
import Playable from "@/components/landing/Playable";
import Requirements from "@/components/landing/Requirements";
import Catalog from "@/components/landing/Catalog";
import Templates from "@/components/landing/Templates";
import RunIt from "@/components/landing/RunIt";
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
      <WhatItIs />
      <Rounds />
      <Results />
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
