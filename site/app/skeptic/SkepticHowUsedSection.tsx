import { Gauge } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export default function SkepticHowUsedSection() {
  return (
    <SiteSection>
      <Identified as="SkepticHowUsedHeading">
        <SiteSectionHeading kicker="How this page is used" />
      </Identified>
      <Identified as="SkepticHowUsedList" tag="ul" className="space-y-2 text-sm leading-6 text-muted-foreground">
        <li className="flex items-start gap-2">
          <Gauge size={12} className="mt-1.5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="text-foreground">Publishing a finding:</strong> read the relevant
            hypothesis section first. If the finding doesn&apos;t survive the critique, soften the
            claim.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Gauge size={12} className="mt-1.5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="text-foreground">Designing a new round:</strong> check the
            falsification conditions. If the round can&apos;t produce data that would falsify a claim,
            the round is testing something else.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Gauge size={12} className="mt-1.5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="text-foreground">When confident:</strong> point yourself here.
            Confidence in early-stage research is the most dangerous failure mode.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Gauge size={12} className="mt-1.5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="text-foreground">When a reader asks &quot;how do I know this is
            real?&quot;:</strong> point them here. The credibility move is admitting what we don&apos;t
            know.
          </span>
        </li>
      </Identified>
    </SiteSection>
  );
}
