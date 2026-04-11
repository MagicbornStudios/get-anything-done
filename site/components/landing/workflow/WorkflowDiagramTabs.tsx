"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowDiagramPanel } from "@/components/landing/workflow/WorkflowDiagramPanel";
import {
  EXPERIMENT_LOOP_DIAGRAM,
  GAD_LOOP_DIAGRAM,
  HYPOTHESIS_TRACKS_DIAGRAM,
} from "@/components/landing/workflow/workflow-shared";

export function WorkflowDiagramTabs() {
  return (
    <Tabs defaultValue="gad-loop" className="mt-12">
      <TabsList className="mb-4">
        <TabsTrigger value="gad-loop">GAD loop</TabsTrigger>
        <TabsTrigger value="hypothesis-tracks">Hypothesis tracks</TabsTrigger>
        <TabsTrigger value="experiment-loop">Experiment loop</TabsTrigger>
      </TabsList>

      <TabsContent value="gad-loop">
        <WorkflowDiagramPanel
          diagram={GAD_LOOP_DIAGRAM}
          mermaidId="mermaid-gad-loop"
          caption="The canonical GAD loop: snapshot for context, pick a task, implement, update planning docs, commit. Subagents handle research, planning, and verification."
        />
      </TabsContent>

      <TabsContent value="hypothesis-tracks">
        <WorkflowDiagramPanel
          diagram={HYPOTHESIS_TRACKS_DIAGRAM}
          mermaidId="mermaid-hypothesis"
          caption="How the three hypotheses evolved across rounds. Each round's findings drove the next round's requirements design. The Freedom hypothesis (bare beats GAD) has held across 4 rounds. The CSH hypothesis (compound skills accumulate) showed its first confirmation in round 4 with emergent v4's skill ratchet."
        />
      </TabsContent>

      <TabsContent value="experiment-loop">
        <WorkflowDiagramPanel
          diagram={EXPERIMENT_LOOP_DIAGRAM}
          mermaidId="mermaid-experiment"
          caption="The experimental method: design requirements, configure conditions (GAD/Bare/Emergent), run eval agents serially with preservation, score with auto + human rubric, analyze findings, then either advance to harder requirements or redesign the approach."
        />
      </TabsContent>
    </Tabs>
  );
}
