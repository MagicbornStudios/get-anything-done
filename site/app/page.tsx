import Hero from "@/components/landing/hero/Hero";
import { Identified } from "@/components/devid/Identified";
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
      <Identified as="LandingHero">
        <Hero />
      </Identified>
      {/* PRIMARY: graph + playable archive adjacent — the research showcase */}
      <Identified as="LandingHypothesisTracksSection">
        <HypothesisTracksSection />
      </Identified>
      <Identified as="LandingPlayableTeaser">
        <PlayableTeaser />
      </Identified>
      {/* CONTEXT: what the project is + how it works */}
      <Identified as="LandingExperimentLog">
        <ExperimentLog />
      </Identified>
      <Identified as="LandingGraphs">
        <Graphs />
      </Identified>
      {/* BACKGROUND: lineage + methodology */}
      <Identified as="LandingLineage">
        <Lineage />
      </Identified>
      <Identified as="LandingWorkflow">
        <Workflow />
      </Identified>
      <Identified as="LandingFramework">
        <Framework />
      </Identified>
      <Identified as="LandingRunIt">
        <RunIt />
      </Identified>
    </MarketingShell>
  );
}
