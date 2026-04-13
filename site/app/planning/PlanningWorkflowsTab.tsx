import type { Workflow } from "@/lib/catalog.generated";
import { Identified } from "@/components/devid/Identified";
import { WorkflowCard } from "@/components/workflow/WorkflowCard";
import {
  buildWorkflowTree,
  partitionWorkflows,
  type WorkflowNode,
} from "@/components/workflow/workflow-tree";

interface Props {
  workflows: readonly Workflow[];
}

/**
 * /planning -> Workflows tab. Three sections per decision gad-174:
 *  1. Authored — hand-authored workflows with expected Mermaid + live React Flow
 *  2. Emergent — proto-workflows drafted from trace synthesis (empty until 42.3-09)
 *  3. Noise panel — deferred to 42.3-13
 */
export function PlanningWorkflowsTab({ workflows }: Props) {
  const { authored, emergent } = partitionWorkflows(workflows);
  const authoredTree = buildWorkflowTree(authored);
  const emergentTree = buildWorkflowTree(emergent);

  return (
    <Identified as="PlanningWorkflowsTab">
      <div className="space-y-10">
        <SectionHeader
          title="Authored workflows"
          count={authored.length}
          blurb="Hand-authored expected graphs that describe how a GAD workflow is supposed to run. Each card shows the authored Mermaid diagram on the left and the live React Flow graph (computed from trace data) on the right. Nested workflows are indented under their parent."
          accent="authored"
        />
        {authoredTree.length === 0 ? (
          <EmptyState message="No authored workflows in the catalog. Add files under .planning/workflows/." />
        ) : (
          <div className="space-y-6">
            {authoredTree.map((node) => (
              <WorkflowTreeNode key={node.workflow.slug} node={node} depth={0} />
            ))}
          </div>
        )}

        <SectionHeader
          title="Emergent workflows"
          count={emergent.length}
          blurb="Proto-workflows drafted by the trace-mining detector (phase 42.3-09) when a recurring pattern crosses the support/stability thresholds. Promote to authored via `gad workflow promote <slug>` or discard. Empty until the detector runs for the first time."
          accent="emergent"
        />
        {emergentTree.length === 0 ? (
          <EmptyState message="No emergent candidates yet. Phase 42.3-09 will populate this section once the DFG + frequent subgraph mining detector ships." />
        ) : (
          <div className="space-y-6">
            {emergentTree.map((node) => (
              <WorkflowTreeNode key={node.workflow.slug} node={node} depth={0} />
            ))}
          </div>
        )}

        <SectionHeader
          title="Noise panel"
          count={0}
          blurb="Raw event timeline + unmatched force-directed graph of events the detector could not absorb into any candidate. Deferred to phase 42.3-13 — ships after the signal sections above prove useful."
          accent="noise"
        />
        <EmptyState message="Deferred to phase 42.3-13." />
      </div>
    </Identified>
  );
}

function WorkflowTreeNode({ node, depth }: { node: WorkflowNode; depth: number }) {
  return (
    <div className="space-y-4">
      <WorkflowCard workflow={node.workflow} depth={depth} />
      {node.children.length > 0 && (
        <div className="space-y-4">
          {node.children.map((child) => (
            <WorkflowTreeNode key={child.workflow.slug} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  blurb,
  accent,
}: {
  title: string;
  count: number;
  blurb: string;
  accent: "authored" | "emergent" | "noise";
}) {
  const accentClass =
    accent === "authored"
      ? "border-sky-500/40"
      : accent === "emergent"
        ? "border-emerald-500/40"
        : "border-muted-foreground/30";
  return (
    <header className={`border-l-4 ${accentClass} pl-4`}>
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <span className="tabular-nums text-sm text-muted-foreground">{count}</span>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{blurb}</p>
    </header>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}
