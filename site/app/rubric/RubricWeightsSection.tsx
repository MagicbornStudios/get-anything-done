import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function RubricWeightsSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={ClipboardList}
        kicker="How to read the weights"
        kickerRowClassName="mb-6 gap-3"
      />
      <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimensions sum to 1.0</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              Weights across a project are normalized to 1.0 so the weighted sum is always in [0.0,
              1.0]. A dimension with weight 0.30 contributes three times as much to the aggregate as
              one with weight 0.10.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Every dimension 0.0 – 1.0</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              Score each dimension independently. A total game-loop softlock tanks playability to
              ~0.10 without forcing you to punish UI polish or mechanics scores. Precision is ~0.05 —
              don&apos;t agonize over 0.82 vs 0.83.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Partial rubrics are allowed</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
              If you genuinely can&apos;t score a dimension (e.g. you couldn&apos;t reach a feature),
              leave it out of the submitted JSON — the aggregate is computed over the dimensions you
              did provide, with a note recorded on the run.
            </CardContent>
          </Card>
        </div>
    </SiteSection>
  );
}
