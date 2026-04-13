import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function EmergentComparisonSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="EmergentComparisonSection">
      <SiteSectionHeading kicker="How emergent differs from bare and GAD" className="mb-6" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bare</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            No framework, no inherited skills. Agent gets AGENTS.md + requirements and builds. Tests the
            freedom hypothesis directly.
          </CardContent>
        </Card>
        <Card className="border-l-4 border-amber-500/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-200">Emergent</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            No framework, but inherits skills from previous runs. Authors a CHANGELOG documenting disposition
            (kept / evolved / deprecated / replaced) of each inherited skill. Tests the CSH. See{" "}
            <Link href="/standards" className="text-accent underline decoration-dotted">
              /standards
            </Link>{" "}
            for the SKILL.md format these skills follow.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">GAD</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Full framework: .planning/ XML, plan/execute/verify/commit loop, skill triggers. Tests whether
            process discipline pays off despite overhead.
          </CardContent>
        </Card>
      </div>
      </Identified>
    </SiteSection>
  );
}
