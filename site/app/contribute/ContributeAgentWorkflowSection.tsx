import { Bot, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";

export function ContributeAgentWorkflowSection() {
  return (
    <SiteSection cid="contribute-agent-workflow-section-site-section">
      <Identified as="ContributeAgentWorkflowSection">
      <SiteSectionHeading
        icon={Bot}
        kicker="Agent workflow — what happens behind the scenes"
        kickerRowClassName="mb-6 gap-3"
      />
      <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
        You don&apos;t need to follow this. It&apos;s here so you know the difference between
        human-facing and agent-facing operations.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal size={14} aria-hidden />
              gad snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Re-hydrates context after auto-compaction. The agent runs this at session start to read
            STATE.xml, TASK-REGISTRY.xml, DECISIONS.xml, and the recent commit history in one shot. It
            produces output that&apos;s only useful for an agent reading its own mental model. Humans
            should <strong>never</strong> need to look at the output.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal size={14} aria-hidden />
              gad eval run / preserve
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            The agent invokes these to start an eval and to preserve its outputs to the canonical{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">evals/</code> directory.
            Preservation is enforced by tests &mdash; an unpreserved run fails the build.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal size={14} aria-hidden />
              gad eval review --rubric
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            The agent (or you, if you played a build) submits a per- dimension rubric review. The
            score lands in TRACE.json under that run&apos;s human_review block and renders on the site
            via the prebuild.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal size={14} aria-hidden />
              Plan / execute / verify / commit loop
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            The GAD planning loop (<Ref id="gad-18" />) the agent follows. One task per iteration:
            read snapshot, pick a task, implement it, update planning XML, commit. The loop survives
            auto- compaction because everything is in the repo.
          </CardContent>
        </Card>
      </div>
      </Identified>
    </SiteSection>
  );
}

