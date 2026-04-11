"use client";

import { WorkflowDiagramTabs } from "@/components/landing/workflow/WorkflowDiagramTabs";
import { WorkflowIntro } from "@/components/landing/workflow/WorkflowIntro";
import { WorkflowSessionTerminal } from "@/components/landing/workflow/WorkflowSessionTerminal";

export default function Workflow() {
  return (
    <section id="workflow" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <WorkflowIntro />
        <WorkflowDiagramTabs />
        <WorkflowSessionTerminal />
      </div>
    </section>
  );
}
