import { BookOpen, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { AGENTSKILLS_URL, ANTHROPIC_GUIDE_URL } from "./standards-shared";

export default function StandardsReferencesSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={BookOpen}
        kicker="The two references"
        kickerRowClassName="mb-6 gap-3"
      />
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-l-4 border-amber-500/60">
          <CardHeader className="pb-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="default" className="bg-amber-500/15 text-amber-300">
                Anthropic
              </Badge>
              <Badge variant="outline">PDF</Badge>
            </div>
            <CardTitle className="text-base leading-tight">
              The Complete Guide to Building Skills for Claude
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            <p className="mb-3">
              Anthropic&apos;s canonical document on authoring skills for Claude. Covers SKILL.md
              format, frontmatter rules, three testing layers (triggering / functional / performance
              comparison), three skill categories (doc-creation / workflow-automation /
              mcp-enhancement), and iteration signals (under-triggering, over-triggering, execution
              issues). Source of truth for how Claude Code loads and activates skills.
            </p>
            <a
              href={ANTHROPIC_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Download the PDF
              <ExternalLink size={11} aria-hidden />
            </a>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-sky-500/60">
          <CardHeader className="pb-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="default" className="bg-sky-500/15 text-sky-300">
                Open standard
              </Badge>
              <Badge variant="outline">agentskills.io</Badge>
            </div>
            <CardTitle className="text-base leading-tight">
              Agent Skills — open format + interoperability standard
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            <p className="mb-3">
              The cross-client open format for skills. Specifies the SKILL.md file structure, the{" "}
              <code className="rounded bg-card/60 px-1 py-0.5 text-xs">.agents/skills/</code>{" "}
              discovery convention for cross-client interoperability, progressive-disclosure three-tier
              loading, name collision handling, trust gating, and a full per-skill evaluation
              methodology. Agents built against this standard should find each other&apos;s skills
              regardless of runtime.
            </p>
            <a
              href={AGENTSKILLS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Read the standard
              <ExternalLink size={11} aria-hidden />
            </a>
          </CardContent>
        </Card>
      </div>
    </SiteSection>
  );
}
