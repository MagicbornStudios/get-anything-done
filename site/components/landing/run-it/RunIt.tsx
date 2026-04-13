import { RunItCtas } from "@/components/landing/run-it/RunItCtas";
import { RunItIntro } from "@/components/landing/run-it/RunItIntro";
import { RunItQuickstart } from "@/components/landing/run-it/RunItQuickstart";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export default function RunIt() {
  return (
    <SiteSection id="run" className="border-t border-border/60">
      <Identified as="LandingRunIt">
      <Identified as="RunItIntro">
        <RunItIntro />
      </Identified>
      <Identified as="RunItQuickstart">
        <RunItQuickstart />
      </Identified>
      <Identified as="RunItCtas">
        <RunItCtas />
      </Identified>
      </Identified>
    </SiteSection>
  );
}
