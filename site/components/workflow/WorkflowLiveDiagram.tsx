"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/**
 * Interactive "live" workflow renderer — React Flow over the same node/edge
 * shape that trace synthesis (phase 42.3-04) and the emergent-workflow
 * detector (phase 42.3-09) will emit.
 *
 * Mermaid handles the *authored* graphs because authored workflows are
 * static and benefit from a single, diffable SVG output. React Flow handles
 * the *live* graphs (actual runs + emergent candidates) because those need
 * pan/zoom, hover inspection, node-level drill-down, and interactive
 * promote/discard controls later.
 *
 * Until 42.3-04 lands this component renders an empty-state placeholder so
 * the page structure is complete before real trace data is available.
 */

export interface LiveWorkflowNodeData {
  label: string;
  kind: "skill" | "agent" | "cli" | "artifact" | "decision";
  count?: number;
  [key: string]: unknown;
}

export interface LiveWorkflow {
  slug: string;
  nodes: Node<LiveWorkflowNodeData>[];
  edges: Edge[];
}

interface Props {
  workflow: LiveWorkflow | null;
  emptyMessage?: string;
  /** Render smaller (240px) with no MiniMap — used by compact emergent cards. */
  compact?: boolean;
}

const KIND_STYLES: Record<LiveWorkflowNodeData["kind"], string> = {
  skill: "border-sky-500/60 bg-sky-500/10 text-sky-100",
  agent: "border-violet-500/60 bg-violet-500/10 text-violet-100",
  cli: "border-amber-500/60 bg-amber-500/10 text-amber-100",
  artifact: "border-emerald-500/60 bg-emerald-500/10 text-emerald-100",
  decision: "border-rose-500/60 bg-rose-500/10 text-rose-100",
};

function LiveWorkflowNode({ data }: NodeProps<Node<LiveWorkflowNodeData>>) {
  const style = KIND_STYLES[data.kind] ?? KIND_STYLES.skill;
  return (
    <div
      className={`rounded-md border px-3 py-2 text-[11px] font-medium shadow-sm ${style}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-foreground/40" />
      <div className="flex items-center gap-2">
        <span className="rounded-sm bg-background/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider opacity-80">
          {data.kind}
        </span>
        <span>{data.label}</span>
        {typeof data.count === "number" ? (
          <span className="tabular-nums text-[10px] opacity-70">×{data.count}</span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-foreground/40" />
    </div>
  );
}

// Defined outside the component per @xyflow/react guidance — stable reference
// so ReactFlow doesn't warn about unstable `nodeTypes` on every render.
const NODE_TYPES = { live: LiveWorkflowNode } as const;

export function WorkflowLiveDiagram({ workflow, emptyMessage, compact = false }: Props) {
  const nodes = useMemo(() => workflow?.nodes ?? [], [workflow]);
  const edges = useMemo(() => workflow?.edges ?? [], [workflow]);

  const heightClass = compact ? "h-56" : "h-[480px]";
  const emptyHeightClass = compact ? "h-40" : "h-64";

  if (!workflow || nodes.length === 0) {
    return (
      <div
        className={`flex ${emptyHeightClass} flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/20 text-center text-xs text-muted-foreground`}
      >
        <span className="font-medium text-foreground/80">No live graph yet</span>
        <span className="mt-1 max-w-md px-4 leading-5">
          {emptyMessage ??
            "Trace synthesis (phase 42.3-04) will populate this view once an instance of the workflow completes. Until then the authored Mermaid graph above is the source of truth."}
        </span>
      </div>
    );
  }

  return (
    <div className={`${heightClass} overflow-hidden rounded-md border border-border/50 bg-background`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="!bg-muted/20" />
        {!compact && <MiniMap pannable zoomable className="!bg-muted/40" />}
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
