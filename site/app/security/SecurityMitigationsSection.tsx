import { ShieldCheck } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { SecurityInfoCard } from "./SecurityInfoCard";

export function SecurityMitigationsSection() {
  return (
    <SiteSection>
      <SiteSectionHeading
        icon={ShieldCheck}
        kicker="What GAD does today"
        kickerRowClassName="mb-6 gap-3"
        iconClassName="text-emerald-400"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SecurityInfoCard
          title="Frontmatter discipline"
          body="Every GAD skill follows Anthropic's SKILL.md format: kebab-case name, description with triggers, no XML angle brackets in frontmatter, and reserved name prefixes rejected."
        />
        <SecurityInfoCard
          title="No postinstall scripts"
          body="GAD skills are markdown plus explicit references. No hidden side effects on install."
        />
        <SecurityInfoCard
          title="Trace-event audit trail"
          body="Eval runs record tool uses, skill invocations, subagent spawns, and file mutations. That makes post-run audit possible even when the run result is bad."
        />
        <SecurityInfoCard
          title="Isolation audit"
          body="There is now a concrete worktree isolation audit in the repo, which is more honest than just claiming eval isolation."
        />
      </div>
    </SiteSection>
  );
}
