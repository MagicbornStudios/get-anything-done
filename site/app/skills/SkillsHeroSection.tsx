import Link from "next/link";
import { SiteInlineMetric, SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

type SkillsHeroSectionProps = {
  totalSkills: number;
  categoryCount: (cat: string) => number;
  usageCount: number;
  agentsCount: number;
};

export function SkillsHeroSection({
  totalSkills,
  categoryCount,
  usageCount,
  agentsCount,
}: SkillsHeroSectionProps) {
  return (
    <SiteSection>
      <SiteSectionHeading
        kicker="Skills"
        as="h1"
        preset="hero"
        title={
          <>
            Every authored skill. <span className="gradient-text">With provenance + real usage.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        The GAD skill catalog, filterable by category, searchable, and cross-referenced against real attribution
        data from <code className="rounded bg-card/60 px-1.5 py-0.5 text-sm">.planning/TASK-REGISTRY.xml</code>. The
        Usage tab shows every skill that&apos;s been tagged on a completed task. The Agents tab aggregates by agent
        identity (claude-code, codex, cursor, or named subagents) so you can see who did what.
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        Provenance per skill (origin run, inheritance lineage, evaluation performance context) per{" "}
        <Link href="/decisions#gad-76" className="text-accent underline decoration-dotted">
          GAD-D-76
        </Link>
        . Attribution mandate per{" "}
        <Link href="/decisions#gad-104" className="text-accent underline decoration-dotted">
          GAD-D-104
        </Link>
        . GAD skills follow the format in the{" "}
        <Link href="/standards" className="text-accent underline decoration-dotted">
          Anthropic skills guide + agentskills.io standard
        </Link>
        .
      </SiteProse>

      <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <SiteInlineMetric label="Total skills" value={totalSkills.toString()} />
        <SiteInlineMetric label="Fundamental" value={categoryCount("fundamental").toString()} />
        <SiteInlineMetric label="Eval-authored" value={categoryCount("eval-authored").toString()} />
        <SiteInlineMetric label="Framework-inherited" value={categoryCount("framework-inherited").toString()} />
        <SiteInlineMetric label="Skills used" value={usageCount.toString()} />
        <SiteInlineMetric label="Agents tracked" value={agentsCount.toString()} />
      </div>
    </SiteSection>
  );
}
