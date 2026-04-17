export const dynamic = "force-dynamic";
import { LandingEvolutionBand } from "@/components/landing/home/LandingEvolutionBand";
import { LandingGraphifyChaosBand } from "@/components/landing/home/LandingGraphifyChaosBand";
import { LandingInstallerUpstreamBand } from "@/components/landing/home/LandingInstallerUpstreamBand";
import { LandingVisualContextAndPromptBand } from "@/components/landing/home/LandingVisualContextAndPromptBand";
import AgentHandoffCycle from "@/components/landing/agent-handoff-cycle/AgentHandoffCycle";
import PlayableTeaser from "@/components/landing/playable/PlayableTeaser";
import { MarketingShell, SectionEpigraph } from "@/components/site";

export default function Page() {
  return (
    <MarketingShell>
      <LandingEvolutionBand />
      <SectionEpigraph section="hero" seed="home-hero" align="center" />
      <LandingGraphifyChaosBand />
      <SectionEpigraph section="system" seed="home-system" />
      <LandingVisualContextAndPromptBand />
      <SectionEpigraph section="planning" seed="home-planning" />
      <PlayableTeaser />
      <SectionEpigraph section="evolution" seed="home-evolution" />
      <AgentHandoffCycle />
      <SectionEpigraph section="findings" seed="home-findings" />
      <LandingInstallerUpstreamBand />
      <SectionEpigraph section="marketplace" seed="home-marketplace" align="center" />
    </MarketingShell>
  );
}
