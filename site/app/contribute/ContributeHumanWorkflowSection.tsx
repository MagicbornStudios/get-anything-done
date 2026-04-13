import { MessageSquare } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { CONTRIBUTE_REPO_URL } from "./contribute-constants";
import { ContributeStep } from "./ContributeStep";

export function ContributeHumanWorkflowSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="ContributeHumanWorkflowSection">
      <SiteSectionHeading
        icon={MessageSquare}
        kicker="Human workflow — what you do"
        kickerRowClassName="mb-6 gap-3"
      />
      <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
        Five steps. Three of them are setup, two are conversation. You never run{" "}
        <code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad snapshot</code> yourself
        &mdash; that&apos;s for the agent.
      </p>

      <div className="space-y-4">
        <ContributeStep
          num="1"
          title="Clone the repo"
          code={`git clone ${CONTRIBUTE_REPO_URL}.git
cd get-anything-done`}
          note="Standard git clone. Pulls the framework code, planning docs, and every preserved eval."
        />
        <ContributeStep
          num="2"
          title="Install GAD skills (canonical path)"
          code={`npx skills add MagicbornStudios/get-anything-done`}
          note="Installs all GAD workspace skills to skills/ + .claude/skills/ via the open-standard skills CLI (vercel-labs/skills). Works with Claude Code, Codex, Cursor, Windsurf, and 40+ other agents. Emergent skills are excluded automatically."
        />
        <ContributeStep
          num="3"
          title="Open the repo in Claude Code (or another agent runtime)"
          note="The .claude/ directory ships with the GAD skills, agents, and hook configuration. Cursor and Codex have their own runtime directories — see the GAD installer for cross-runtime setup. Whichever you use, the agent picks up the GAD skills automatically when the repo opens."
        />
        <ContributeStep
          num="4"
          title="Talk to the agent about what you want to do"
          note="No XML editing, no manual snapshot, no learning the framework. Just describe your intent."
          examples={[
            '"Run the escape-the-dungeon-bare eval against requirements v5"',
            '"Add a new open question about the pressure score formula and cite gad-75"',
            '"I want to test a new hypothesis: do agents perform better with smaller tool budgets? Help me design an eval"',
            '"Submit a rubric review for escape-the-dungeon-emergent v5"',
          ]}
        />
        <ContributeStep
          num="5"
          title="Read the results on the site"
          note="When the agent finishes, the site picks up the new data automatically on the next prebuild. Findings, scores, and decisions are all rendered as static pages — open them in your browser and skim."
        />
      </div>
      </Identified>
    </SiteSection>
  );
}
