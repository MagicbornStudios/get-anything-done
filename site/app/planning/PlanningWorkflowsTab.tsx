import type { HumanWorkflow, Signal, Workflow } from "@/lib/catalog.generated";
import { Identified } from "@/components/devid/Identified";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanningDiscoveryTab } from "./PlanningDiscoveryTab";
import { PlanningTabHumanWorkflows } from "./PlanningTabHumanWorkflows";
import { PlanningTabSignal } from "./PlanningTabSignal";
import { WorkflowCard } from "@/components/workflow/WorkflowCard";
import {
  buildWorkflowTree,
  partitionWorkflows,
  type WorkflowNode,
} from "@/components/workflow/workflow-tree";

interface Props {
  workflows: readonly Workflow[];
  signal: Signal;
  humanWorkflows: readonly HumanWorkflow[];
}

/**
 * /planning -> Workflows tab:
 *  1. Local tabs: Authored / Signal / Human workflows / Discovery
 *  2. Authored is hand-authored workflows with expected Mermaid + live React Flow
 */
export function PlanningWorkflowsTab({ workflows, signal, humanWorkflows }: Props) {
  const { authored } = partitionWorkflows(workflows);
  const authoredTree = buildWorkflowTree(authored);

  return (
    <Identified as="PlanningTabWorkflows">
      <div className="space-y-8">
        <MethodologyCallout />

        <Tabs defaultValue="signal">
          <TabsList>
            <TabsTrigger value="authored">
              Authored{" "}
              <span className="ml-1.5 tabular-nums text-muted-foreground">{authored.length}</span>
            </TabsTrigger>
            <TabsTrigger value="signal">Signal</TabsTrigger>
            <TabsTrigger value="human-workflows">Human workflows</TabsTrigger>
            <TabsTrigger value="discovery">Discovery</TabsTrigger>
          </TabsList>

          <TabsContent value="authored">
            <div className="space-y-4">
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Designed workflows. Live React Flow graph is primary; authored Mermaid is tucked under a disclosure.
              </p>
              {authoredTree.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
                  No authored workflows. Add files under .planning/workflows/.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {flattenTree(authoredTree).map(({ node, depth }) => (
                    <WorkflowCard key={node.workflow.slug} workflow={node.workflow} depth={depth} compact />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="signal">
            <PlanningTabSignal signal={signal} />
          </TabsContent>

          <TabsContent value="human-workflows">
            <PlanningTabHumanWorkflows workflows={humanWorkflows} />
          </TabsContent>

          <TabsContent value="discovery">
            <PlanningDiscoveryTab />
          </TabsContent>
        </Tabs>
      </div>
    </Identified>
  );
}

function flattenTree(tree: WorkflowNode[], depth = 0): Array<{ node: WorkflowNode; depth: number }> {
  const out: Array<{ node: WorkflowNode; depth: number }> = [];
  for (const node of tree) {
    out.push({ node, depth });
    if (node.children.length > 0) {
      out.push(...flattenTree(node.children, depth + 1));
    }
  }
  return out;
}

/**
 * Inline methodology callout explaining how the Workflows tab is built.
 */
function MethodologyCallout() {
  return (
    <details className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-foreground/90">How this tab is built</summary>
      <div className="mt-2 space-y-2 leading-6">
        <p>
          Authored workflows come from <code className="text-foreground/80">.planning/workflows/*.md</code>. Live graphs are computed from <code className="text-foreground/80">.planning/.trace-events.jsonl</code> (gad-framework scope only - decision gad-175).
        </p>
        <p>
          Emergent patterns are mined via a v1 DFG + n-gram detector (decision gad-178); the v2 target is skill-invocation sequences, not raw tool names. Full methodology doc is task 42.3-17.
        </p>
      </div>
    </details>
  );
}
