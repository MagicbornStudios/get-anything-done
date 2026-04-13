import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import { ContributeAgentWorkflowSection } from "./ContributeAgentWorkflowSection";
import { ContributeHeroSection } from "./ContributeHeroSection";
import { ContributeHumanWorkflowSection } from "./ContributeHumanWorkflowSection";
import { ContributeIdeasSection } from "./ContributeIdeasSection";
import { ContributeLinksSection } from "./ContributeLinksSection";

export const metadata = {
  title: "Contribute — GAD",
  description:
    "How to clone the repo and run your own eval. Human-first workflow — snapshot is for the agent, not for you.",
};

export default function ContributePage() {
  return (
    <MarketingShell>
      <Identified as="ContributeHeroSection">
        <ContributeHeroSection />
      </Identified>
      <Identified as="ContributeHumanWorkflowSection">
        <ContributeHumanWorkflowSection />
      </Identified>
      <Identified as="ContributeAgentWorkflowSection">
        <ContributeAgentWorkflowSection />
      </Identified>
      <Identified as="ContributeIdeasSection">
        <ContributeIdeasSection />
      </Identified>
      <Identified as="ContributeLinksSection">
        <ContributeLinksSection />
      </Identified>
    </MarketingShell>
  );
}
