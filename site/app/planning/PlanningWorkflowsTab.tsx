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
        <MethodologyCallout />
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
          blurb="Proto-workflows drafted by the trace-mining detector (phase 42.3-09) when a recurring pattern crosses the support/stability thresholds. Emergent workflows are rendered as React Flow graphs only — they have no authored Mermaid because nobody designed them. Promote via `gad workflow promote <slug>` or discard."
          accent="emergent"
        />
        {emergent.length === 0 ? (
          <EmptyState message="No emergent candidates yet. Once gad-framework-scoped trace events accumulate (sessions working on GAD itself, not inside eval worktrees), the detector will populate this section." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {emergent.map((w) => (
              <WorkflowCard key={w.slug} workflow={w} compact />
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

/**
 * Inline methodology callout explaining how the Workflows tab is built —
 * trace source scoping, detector version, and the v1-vs-v2 target. The
 * full methodology page is task 42.3-17 (deferred until 42.3-16 deep-dive
 * lands so the doc reflects the real v2 model). This inline version is
 * enough to make the tab legible to readers who aren't the operator.
 */
function MethodologyCallout() {
  return (
    <aside
      aria-labelledby="workflows-methodology-title"
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-6 text-muted-foreground"
    >
      <h3
        id="workflows-methodology-title"
        className="mb-1.5 text-sm font-semibold text-foreground"
      >
        How this tab is built
      </h3>
      <p>
        Authored workflows come from hand-written Markdown files under{" "}
        <code className="text-foreground/80">.planning/workflows/*.md</code> — each
        declares expected participants (skills, agents, CLI commands, artifacts)
        and a Mermaid diagram of the expected shape. The build pipeline
        (<code className="text-foreground/80">site/scripts/build-site-data.mjs</code>)
        scans them into the <code className="text-foreground/80">WORKFLOWS</code>
        {" "}catalog.
      </p>
      <p className="mt-2">
        Live graphs are computed from{" "}
        <code className="text-foreground/80">.planning/.trace-events.jsonl</code>
        {" "}filtered to the{" "}
        <code className="text-foreground/80">gad-framework</code> scope (decision
        gad-175 — eval-agent events produced inside worktrees are excluded). The
        v1 detector matches authored participants against observed{" "}
        <code className="text-foreground/80">tool_use</code> and{" "}
        <code className="text-foreground/80">file_mutation</code> events and
        emits a <code className="text-foreground/80">conformance</code> score
        (<code className="text-foreground/80">max(0, matched − extra) / expected</code>).
      </p>
      <p className="mt-2">
        Emergent candidates come from a simple DFG + n-gram detector over the
        same trace stream. This is a <strong>v1 tool-level shortcut</strong>{" "}
        (decision gad-178): the real target is mining{" "}
        <em>skill invocation</em> sequences, not raw tool names, so the
        current top patterns (<code className="text-foreground/80">bash × 3</code>,{" "}
        <code className="text-foreground/80">read → edit → edit</code>) are
        noise that will be replaced once the detector v2 lands (task
        42.3-16). The full methodology page is task 42.3-17 and waits on the
        v2 deep-dive.
      </p>
    </aside>
  );
}
