import { LandingEvolutionBand } from "@/components/landing/home/LandingEvolutionBand";
import { LandingInstallerUpstreamBand } from "@/components/landing/home/LandingInstallerUpstreamBand";
import { LandingVisualContextAndPromptBand } from "@/components/landing/home/LandingVisualContextAndPromptBand";
import Lineage from "@/components/landing/lineage/Lineage";
import PlayableTeaser from "@/components/landing/playable/PlayableTeaser";
import { MarketingShell } from "@/components/site";

export default function Page() {
  return (
    <MarketingShell>
      <LandingEvolutionBand />
      <LandingVisualContextAndPromptBand />
      <PlayableTeaser />
      <Lineage />
      <LandingInstallerUpstreamBand />
    </MarketingShell>
  );
}
