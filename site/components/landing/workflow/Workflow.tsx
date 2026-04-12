"use client";

import { WorkflowDiagramTabs } from "@/components/landing/workflow/WorkflowDiagramTabs";
import { WorkflowIntro } from "@/components/landing/workflow/WorkflowIntro";
import { WorkflowSessionTerminal } from "@/components/landing/workflow/WorkflowSessionTerminal";
import { SiteSection } from "@/components/site";

export default function Workflow() {
  return (
    <SiteSection id="workflow" tone="muted" className="border-t border-border/60">
      <WorkflowIntro />
      <WorkflowDiagramTabs />
      <WorkflowSessionTerminal />
    </SiteSection>
  );
}
