import { RunItCtas } from "@/components/landing/run-it/RunItCtas";
import { RunItIntro } from "@/components/landing/run-it/RunItIntro";
import { RunItQuickstart } from "@/components/landing/run-it/RunItQuickstart";
import { SiteSection } from "@/components/site";

export default function RunIt() {
  return (
    <SiteSection id="run" className="border-t border-border/60">
      <RunItIntro />
      <RunItQuickstart />
      <RunItCtas />
    </SiteSection>
  );
}
