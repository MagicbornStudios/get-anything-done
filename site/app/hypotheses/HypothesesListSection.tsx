import { FlaskConical } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { HYPOTHESES } from "./hypotheses-data";
import { HypothesesHypothesisCard } from "./HypothesesHypothesisCard";

export function HypothesesListSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading icon={FlaskConical} kicker="Current hypotheses" kickerRowClassName="mb-8 gap-3" />
      <div className="space-y-5">
        {HYPOTHESES.map((h) => (
          <HypothesesHypothesisCard key={h.id} h={h} />
        ))}
      </div>
    </SiteSection>
  );
}
