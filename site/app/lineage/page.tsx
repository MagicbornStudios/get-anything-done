import { LineageContextRotSection } from "@/app/lineage/LineageContextRotSection";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
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
    <MarketingShell>
      <Identified as="LineagePageHero">
        <LineagePageHero />
      </Identified>
      <Identified as="LineageContextRotSection">
        <LineageContextRotSection />
      </Identified>
      <Identified as="LineagePredecessorsSection">
        <LineagePredecessorsSection />
      </Identified>
      <Identified as="LineageMeasurementSection">
        <LineageMeasurementSection />
      </Identified>
    </MarketingShell>
  );
}
