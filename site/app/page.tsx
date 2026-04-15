import { LandingEvolutionBand } from "@/components/landing/home/LandingEvolutionBand";
import { LandingInstallerUpstreamBand } from "@/components/landing/home/LandingInstallerUpstreamBand";
import { LandingVisualContextAndPromptBand } from "@/components/landing/home/LandingVisualContextAndPromptBand";
import Lineage from "@/components/landing/lineage/Lineage";
import Framework from "@/components/landing/framework/Framework";
import PlayableTeaser from "@/components/landing/playable/PlayableTeaser";
import RunIt from "@/components/landing/run-it/RunIt";
import { MarketingShell } from "@/components/site";

export default function Page() {
  return (
    <MarketingShell>
      <LandingEvolutionBand />
      <LandingVisualContextAndPromptBand />
      <PlayableTeaser />
      <Lineage />
      <Framework />
      <LandingInstallerUpstreamBand />
      <RunIt />
    </MarketingShell>
  );
}
