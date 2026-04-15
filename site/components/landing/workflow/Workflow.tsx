"use client";

import { WorkflowDiagramTabs } from "@/components/landing/workflow/WorkflowDiagramTabs";
import { WorkflowIntro } from "@/components/landing/workflow/WorkflowIntro";
import { WorkflowSessionTerminal } from "@/components/landing/workflow/WorkflowSessionTerminal";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export default function Workflow() {
  return (
    <SiteSection id="workflow" cid="workflow-site-section" tone="muted" className="border-t border-border/60">
      <Identified as="LandingWorkflow">
      <Identified as="WorkflowIntro">
        <WorkflowIntro />
      </Identified>
      <Identified as="WorkflowDiagramTabs">
        <WorkflowDiagramTabs />
      </Identified>
      <Identified as="WorkflowSessionTerminal">
        <WorkflowSessionTerminal />
      </Identified>
      </Identified>
    </SiteSection>
  );
}

