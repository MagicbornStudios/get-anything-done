import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function ContentDrivenMeasureSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="ContentDrivenMeasureSection">
      <SiteSectionHeading
        icon={Package}
        kicker="What the content-driven track would measure"
        kickerRowClassName="mb-6 gap-3"
        iconClassName="text-pink-400"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-pink-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Scope expansion</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Given the same token budget, does the agent produce a bigger game when the content pack already exists? More
            rooms, more encounters, deeper mechanics — measured against a greenfield run of the same agent with the same
            budget.
          </CardContent>
        </Card>
        <Card className="border-l-4 border-pink-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Integration coherence</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Does the agent weave the pre-authored content into a unified game, or does the inherited canon feel bolted on?
            Narrative consistency, tonal consistency, mechanical consistency — all human-reviewed.
          </CardContent>
        </Card>
        <Card className="border-l-4 border-pink-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What the agent adds</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Percentage of the final game that is the agent&apos;s own authorship vs the inherited canon. Too low → the
            agent didn&apos;t add anything. Too high → the content pack was ignored. A healthy ratio is somewhere in
            between.
          </CardContent>
        </Card>
      </div>
      </Identified>
    </SiteSection>
  );
}
