import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function FreedomBareMeansSection() {
  return (
    <SiteSection>
      <SiteSectionHeading kicker='What "bare" means' className="mb-6" />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">No framework</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Bare runs get AGENTS.md + REQUIREMENTS.xml. No .planning/ XML, no plan-execute-verify loop,
            no skill library, no subagents. The agent creates its own structure.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Own workflow</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            The agent authors whatever planning artifacts it finds useful under{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">game/.planning/</code>. Per decision
            gad-39, all workflow artifacts live there regardless of framework choice.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contrast with emergent</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Bare starts cold every time. Emergent starts warm with inherited skills from prior runs. Both
            have no framework, but emergent tests compounding (CSH) while bare tests freedom. See{" "}
            <Link href="/standards" className="text-accent underline decoration-dotted">
              /standards
            </Link>{" "}
            for the Anthropic skills guide + agentskills.io convention.
          </CardContent>
        </Card>
      </div>
    </SiteSection>
  );
}
