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
      <ContributeHeroSection />
      <ContributeHumanWorkflowSection />
      <ContributeAgentWorkflowSection />
      <ContributeIdeasSection />
      <ContributeLinksSection />
    </MarketingShell>
  );
}
