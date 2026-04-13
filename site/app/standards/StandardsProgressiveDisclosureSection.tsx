import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { AGENTSKILLS_URL } from "./standards-shared";

export default function StandardsProgressiveDisclosureSection() {
  return (
    <SiteSection>
      <Identified as="StandardsProgressiveDisclosureSection">
      <SiteSectionHeading
        icon={Layers}
        kicker="Progressive disclosure — three tiers"
        kickerRowClassName="mb-6 gap-3"
      />
      <SiteProse size="sm" className="mb-6">
        Per{" "}
        <a
          href={`${AGENTSKILLS_URL}/client-implementation/adding-skills-support`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-dotted"
        >
          agentskills.io client implementation
        </a>
        , every compliant agent follows the same three-tier load strategy. This is what keeps skill
        libraries scalable — you don&apos;t pay the token cost of every installed skill upfront,
        only the ones actually used in a conversation.
      </SiteProse>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <Badge variant="outline" className="mb-1 w-fit">
              tier 1
            </Badge>
            <CardTitle className="text-base">Catalog</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            <p className="mb-2">Name + description only. Loaded at session start.</p>
            <p className="text-[11px]">
              Token cost: ~50-100 tokens per skill. 27 skills in GAD ≈ ~2000 tokens for the full
              catalog.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Badge variant="outline" className="mb-1 w-fit">
              tier 2
            </Badge>
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            <p className="mb-2">
              Full SKILL.md body. Loaded when the agent decides a skill is relevant to the current
              task.
            </p>
            <p className="text-[11px]">Token cost: &lt;5000 tokens recommended per skill.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Badge variant="outline" className="mb-1 w-fit">
              tier 3
            </Badge>
            <CardTitle className="text-base">Resources</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            <p className="mb-2">
              Scripts, references, assets bundled in the skill directory. Loaded on-demand when
              instructions reference them.
            </p>
            <p className="text-[11px]">Token cost: varies — pay only for the files actually read.</p>
          </CardContent>
        </Card>
      </div>
      </Identified>
    </SiteSection>
  );
}
