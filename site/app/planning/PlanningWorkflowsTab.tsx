import type { HumanWorkflow, Signal, Workflow } from "@/lib/catalog.generated";
import { Identified } from "@/components/devid/Identified";
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
 * /planning -> Workflows tab. Sections per decision gad-174:
 *  1. Authored — hand-authored workflows with expected Mermaid + live React Flow
 *  2. Emergent — proto-workflows drafted from trace synthesis (empty until 42.3-09)
 *  3. Noise panel — deferred to 42.3-13
 *  4. Signal — trace reducer band (`cid="planning-signal-site-section"`, same subtree as former Signal tab)
 *  5. Human workflows — operator routines (`cid="planning-human-workflows-site-section"`)
 *  6. Discovery — subagent discovery battery (`cid="planning-discovery-tab-site-section"`)
 */
export function PlanningWorkflowsTab({ workflows, signal, humanWorkflows }: Props) {
  const { authored, emergent } = partitionWorkflows(workflows);
  const authoredTree = buildWorkflowTree(authored);
  const emergentTree = buildWorkflowTree(emergent);

  return (
    <Identified as="PlanningTabWorkflows">
      <div className="space-y-8">
        <MethodologyCallout />

        <SectionHeader
          title="Authored"
          count={authored.length}
          blurb="Designed workflows. Live React Flow graph is primary; authored Mermaid is tucked under a disclosure."
          accent="authored"
        />
        {authoredTree.length === 0 ? (
          <EmptyState message="No authored workflows. Add files under .planning/workflows/." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {flattenTree(authoredTree).map(({ node, depth }) => (
              <WorkflowCard key={node.workflow.slug} workflow={node.workflow} depth={depth} compact />
            ))}
          </div>
        )}

        <SectionHeader
          title="Emergent"
          count={emergent.length}
          blurb="Trace-mined patterns (v1 tool-level). Promote with `gad workflow promote <slug>` or discard."
          accent="emergent"
        />
        {emergent.length === 0 ? (
          <EmptyState message="No emergent candidates yet. Mine gad-framework-scoped traces to populate." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {emergent.map((w) => (
              <WorkflowCard key={w.slug} workflow={w} compact />
            ))}
          </div>
        )}

        <SectionHeader
          title="Noise panel"
          count={0}
          blurb="Unmatched events + raw timeline. Deferred to 42.3-13 (under discussion)."
          accent="noise"
        />
        <EmptyState message="Deferred — still under discussion." />

        <PlanningTabSignal signal={signal} />

        <PlanningTabHumanWorkflows workflows={humanWorkflows} />

        <PlanningDiscoveryTab />
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

/**
 * Inline methodology callout explaining how the Workflows tab is built —
 * trace source scoping, detector version, and the v1-vs-v2 target. The
 * full methodology page is task 42.3-17 (deferred until 42.3-16 deep-dive
 * lands so the doc reflects the real v2 model). This inline version is
 * enough to make the tab legible to readers who aren't the operator.
 */
function MethodologyCallout() {
  return (
    <details className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-foreground/90">How this tab is built</summary>
      <div className="mt-2 space-y-2 leading-6">
        <p>
          Authored workflows come from <code className="text-foreground/80">.planning/workflows/*.md</code>. Live graphs are computed from <code className="text-foreground/80">.planning/.trace-events.jsonl</code> (gad-framework scope only — decision gad-175).
        </p>
        <p>
          Emergent patterns are mined via a v1 DFG + n-gram detector (decision gad-178); the v2 target is skill-invocation sequences, not raw tool names. Full methodology doc is task 42.3-17.
        </p>
      </div>
    </details>
  );
}
