import { AlertTriangle } from "lucide-react";
import { SiteSection, SiteSectionHeading, SiteProse, SiteTextCard } from "@/components/site";

export function LineageContextRotSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={AlertTriangle}
        kicker="The problem"
        title="Context rot in three symptoms"
      />
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <SiteTextCard title="Decision drift">
          Something the agent decided at minute 5 gets quietly contradicted at minute 45. Neither
          version is wrong in isolation, but together they&apos;re inconsistent. Without a durable
          record of why the first call was made, the agent has no way to know it should stay
          consistent.
        </SiteTextCard>
        <SiteTextCard title="Invisible in-flight work">
          Half-done tasks disappear from the agent&apos;s working set as soon as something more urgent
          arrives. Three sessions later, the user has to remember what was in flight — the agent
          certainly doesn&apos;t. Context windows aren&apos;t memory, they&apos;re a rolling window.
        </SiteTextCard>
        <SiteTextCard title="Requirements slippage">
          The original ask gets refactored in the agent&apos;s head as the conversation evolves. By
          the end of a long session the code satisfies something related to but not exactly what was
          originally requested. Without a committed spec in the repo, there&apos;s no authority to
          hold the drift accountable against.
        </SiteTextCard>
      </div>
      <SiteProse size="sm" className="mt-8">
        All three symptoms have the same root cause:{" "}
        <strong className="text-foreground">
          the agent&apos;s memory is ephemeral but the work is persistent
        </strong>
        . The fix every framework in this space converges on is the same: put the context in the
        repo, not in the session.
      </SiteProse>
    </SiteSection>
  );
}
