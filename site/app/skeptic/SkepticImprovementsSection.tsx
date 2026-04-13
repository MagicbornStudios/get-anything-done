import { Beaker } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { IMPROVEMENTS } from "./skeptic-shared";

export default function SkepticImprovementsSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="SkepticImprovementsHeading">
        <SiteSectionHeading
        icon={Beaker}
        kicker="What would make us more credible"
        iconClassName="text-emerald-400"
        kickerRowClassName="mb-6 gap-3"
        />
        <SiteProse size="sm" className="mb-6">
        Concrete moves, ranked by how much they&apos;d actually move the needle. The top three are
        doable in the next session if we choose to prioritize credibility over feature velocity.
        </SiteProse>
      </Identified>
      <div className="space-y-3">
        {IMPROVEMENTS.map((imp) => (
          <Identified key={imp.rank} as={`SkepticImprovement-${imp.rank}`}>
            <Card className="border-l-4 border-emerald-500/40">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 font-mono text-sm font-semibold text-emerald-300">
                  {imp.rank}
                </span>
                <CardTitle className="text-base leading-tight">{imp.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pl-12 text-sm leading-6 text-muted-foreground">
              {imp.body}
            </CardContent>
          </Card>
          </Identified>
        ))}
      </div>
    </SiteSection>
  );
}
