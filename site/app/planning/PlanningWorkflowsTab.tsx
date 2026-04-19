import type { HumanWorkflow, Signal, Workflow } from "@/lib/catalog.generated";
import { Identified } from "@/components/devid/Identified";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanningDiscoveryTab } from "./PlanningDiscoveryTab";
import { PlanningTabHumanWorkflows } from "./PlanningTabHumanWorkflows";
import { PlanningTabSignal } from "./PlanningTabSignal";

interface Props {
  workflows: readonly Workflow[];
  signal: Signal;
  humanWorkflows: readonly HumanWorkflow[];
}

/**
 * /planning -> Workflows tab:
 *  1. Agent split band
 *  2. Local tabs: Signal / Human workflows / Discovery
 */
export function PlanningWorkflowsTab({ signal, humanWorkflows }: Props) {
  const roleEntries = Object.entries(signal.agentSplit.byRole).sort(
    (a, b) => b[1] - a[1],
  );
  const topRoles = roleEntries
    .slice(0, 5)
    .map(([role, count]) => `${role} (${count})`)
    .join(", ");

  return (
    <Identified as="PlanningTabWorkflows">
      <div className="space-y-8">
        <MethodologyCallout />

        <Identified as="PlanningWorkflowsAgentSplitBand">
          <section className="space-y-3">
            <header>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Agent split</h3>
              <p className="text-xs text-muted-foreground">Default session vs subagent</p>
            </header>
            <div className="grid grid-cols-2 gap-3">
              <Identified as="PlanningWorkflowsAgentSplitDefault">
                <SplitCell label="Default (main session)" count={signal.agentSplit.default} />
              </Identified>
              <Identified as="PlanningWorkflowsAgentSplitSubagents">
                <SplitCell label="Subagents" count={signal.agentSplit.sub} />
              </Identified>
            </div>
            {topRoles && (
              <p className="mt-3 text-xs text-muted-foreground">Top subagent roles: {topRoles}</p>
            )}
          </section>
        </Identified>

        <Tabs defaultValue="signal">
          <Identified as="PlanningWorkflowsTabsList">
            <TabsList>
              <Identified as="PlanningWorkflowsTriggerSignal">
                <TabsTrigger value="signal">Signal</TabsTrigger>
              </Identified>
              <Identified as="PlanningWorkflowsTriggerHumanWorkflows">
                <TabsTrigger value="human-workflows">Human workflows</TabsTrigger>
              </Identified>
              <Identified as="PlanningWorkflowsTriggerDiscovery">
                <TabsTrigger value="discovery">Discovery</TabsTrigger>
              </Identified>
            </TabsList>
          </Identified>

          <TabsContent value="signal">
            <Identified as="PlanningWorkflowsPanelSignal">
              <PlanningTabSignal signal={signal} />
            </Identified>
          </TabsContent>

          <TabsContent value="human-workflows">
            <Identified as="PlanningWorkflowsPanelHumanWorkflows">
              <PlanningTabHumanWorkflows workflows={humanWorkflows} />
            </Identified>
          </TabsContent>

          <TabsContent value="discovery">
            <Identified as="PlanningWorkflowsPanelDiscovery">
              <PlanningDiscoveryTab />
            </Identified>
          </TabsContent>
        </Tabs>
      </div>
    </Identified>
  );
}

function SplitCell({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{count}</div>
    </div>
  );
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
          Signal uses reducers over <code className="text-foreground/80">.planning/.trace-events.jsonl</code> (gad-framework scope only - decision gad-175).
        </p>
        <p>
          Human workflows live under <code className="text-foreground/80">.planning/human-workflows/*.md</code>. Discovery surfaces the subagent discovery battery outputs.
        </p>
        <p>
          Full methodology — trace schema, scope classification, conformance
          formula, skill-level v2 detector, three-section display:{" "}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href="/workflows/methodology"
          >
            /workflows/methodology →
          </a>
        </p>
      </div>
    </details>
  );
}
