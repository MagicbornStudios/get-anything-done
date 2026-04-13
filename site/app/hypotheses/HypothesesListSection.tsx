import { FlaskConical } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { HYPOTHESES } from "./hypotheses-data";
import { HypothesesHypothesisCard } from "./HypothesesHypothesisCard";

export function HypothesesListSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="HypothesesListSection">
      <Identified as="HypothesesListHeading" register={false}>
        <SiteSectionHeading icon={FlaskConical} kicker="Current hypotheses" kickerRowClassName="mb-8 gap-3" />
      </Identified>
      <Identified as="HypothesesHypothesisCards" className="space-y-5">
        {HYPOTHESES.map((h) => (
          <Identified key={h.id} as={`HypothesesHypothesisCard-${h.id}`}>
            <HypothesesHypothesisCard h={h} />
          </Identified>
        ))}
      </Identified>
      </Identified>
    </SiteSection>
  );
}
