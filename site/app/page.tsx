import Hero from "@/components/landing/hero/Hero";
import { MarketingShell } from "@/components/site";
import HypothesisTracksSection from "@/components/landing/hypothesis-tracks/HypothesisTracksSection";
import Lineage from "@/components/landing/lineage/Lineage";
import Workflow from "@/components/landing/workflow/Workflow";
import Framework from "@/components/landing/framework/Framework";
import ExperimentLog from "@/components/landing/experiment-log/ExperimentLog";
import Graphs from "@/components/landing/graphs/Graphs";
import PlayableTeaser from "@/components/landing/playable/PlayableTeaser";
import RunIt from "@/components/landing/run-it/RunIt";

export default function Page() {
  return (
    <MarketingShell>
      <Hero />
      {/* PRIMARY: graph + playable archive adjacent — the research showcase */}
      <HypothesisTracksSection />
      <PlayableTeaser />
      {/* CONTEXT: what the project is + how it works */}
      <ExperimentLog />
      <Graphs />
      {/* BACKGROUND: lineage + methodology */}
      <Lineage />
      <Workflow />
      <Framework />
      <RunIt />
    </MarketingShell>
  );
}
