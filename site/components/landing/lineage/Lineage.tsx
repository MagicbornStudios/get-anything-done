import { LineageCopy } from "@/components/landing/lineage/LineageCopy";
import { LineageMedia } from "@/components/landing/lineage/LineageMedia";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export default function Lineage() {
  return (
    <SiteSection id="lineage" tone="muted" className="border-t border-border/60">
      <Identified as="LandingLineage">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-start lg:gap-16">
        <Identified as="LineageCopy">
          <LineageCopy />
        </Identified>
        <Identified as="LineageMedia">
          <LineageMedia />
        </Identified>
      </div>
      </Identified>
    </SiteSection>
  );
}
