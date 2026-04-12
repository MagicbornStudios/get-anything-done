import { AlertTriangle, ExternalLink } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function SecurityFurtherReadingSection() {
  return (
    <SiteSection>
      <SiteSectionHeading icon={AlertTriangle} kicker="Further reading" kickerRowClassName="mb-6 gap-3" />
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        <a
          href="https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Anthropic - Complete Guide to Building Skills for Claude
          <ExternalLink size={11} aria-hidden />
        </a>
        <p className="text-xs">
          Canonical reference for SKILL.md format, frontmatter rules, testing layers, and skill categories.
        </p>
      </div>
    </SiteSection>
  );
}
