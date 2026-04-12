import { History } from "lucide-react";
import { LINEAGE_PREDECESSORS } from "@/app/lineage/lineage-data";
import { LineagePredecessorArticle } from "@/app/lineage/LineagePredecessorArticle";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function LineagePredecessorsSection() {
  return (
    <SiteSection>
      <SiteSectionHeading
        icon={History}
        kicker="Predecessors"
        title="Two projects GAD is downstream of"
      />

      <div className="mt-10 space-y-8">
        {LINEAGE_PREDECESSORS.map((p) => (
          <LineagePredecessorArticle key={p.name} predecessor={p} />
        ))}
      </div>
    </SiteSection>
  );
}
