import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteSection } from "@/components/site";
import { SkillsPageTabs } from "./SkillsPageTabs";
import { SkillsHeroSection } from "./SkillsHeroSection";
import { buildAgentUsage, buildSkillUsage, buildSummaries } from "./skills-page-builders";

export const metadata = {
  title: "Skills — GAD",
  description:
    "Every authored skill in the GAD framework, plus real usage stats and agent attribution data from TASK-REGISTRY.xml.",
};

export default function SkillsIndexPage() {
  const summaries = buildSummaries();
  const usage = buildSkillUsage(summaries);
  const agents = buildAgentUsage();

  const categoryCount = (cat: string) => summaries.filter((s) => s.category === cat).length;

  return (
    <MarketingShell>
      <Identified as="SkillsHeroSection">
        <SkillsHeroSection
          totalSkills={summaries.length}
          categoryCount={categoryCount}
          usageCount={usage.length}
          agentsCount={agents.length}
        />
      </Identified>

      <SiteSection tone="muted" className="border-t border-border/60">
        <Identified as="SkillsPageTabsSection">
          <SkillsPageTabs summaries={summaries} usage={usage} agents={agents} />
        </Identified>
      </SiteSection>
    </MarketingShell>
  );
}
