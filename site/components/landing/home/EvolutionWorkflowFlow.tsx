"use client";

import { useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
  {
    id: "pressure",
    type: "default",
    position: { x: 0, y: 88 },
    data: { label: "Pressure\n(tasks × crosscuts)" },
    style: {
      width: 150,
      textAlign: "center",
      fontSize: 11,
      lineHeight: 1.35,
      fontWeight: 600,
      whiteSpace: "pre-line",
    },
  },
  {
    id: "candidates",
    type: "default",
    position: { x: 200, y: 92 },
    data: { label: "Skill candidates" },
    style: { width: 130, textAlign: "center", fontSize: 11, fontWeight: 600 },
  },
  {
    id: "review",
    type: "default",
    position: { x: 380, y: 96 },
    data: { label: "Review" },
    style: { width: 100, textAlign: "center", fontSize: 11, fontWeight: 600 },
  },
  {
    id: "proto",
    type: "default",
    position: { x: 530, y: 88 },
    data: { label: "Proto skills\n(staged)" },
    style: {
      width: 130,
      textAlign: "center",
      fontSize: 11,
      lineHeight: 1.35,
      fontWeight: 600,
      whiteSpace: "pre-line",
    },
  },
  {
    id: "roto",
    type: "default",
    position: { x: 720, y: 88 },
    data: { label: "Roto skills\n(permanent)" },
    style: {
      width: 130,
      textAlign: "center",
      fontSize: 11,
      lineHeight: 1.35,
      fontWeight: 600,
      whiteSpace: "pre-line",
    },
  },
];

const edgeStyle = { stroke: "color-mix(in oklch, var(--accent) 55%, var(--border))", strokeWidth: 2 };

const initialEdges: Edge[] = [
  {
    id: "e1",
    source: "pressure",
    target: "candidates",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: edgeStyle,
  },
  {
    id: "e2",
    source: "candidates",
    target: "review",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: edgeStyle,
  },
  {
    id: "e3",
    source: "review",
    target: "proto",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: edgeStyle,
  },
  {
    id: "e4",
    source: "proto",
    target: "roto",
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: edgeStyle,
  },
  {
    id: "e5",
    source: "roto",
    target: "pressure",
    sourceHandle: undefined,
    targetHandle: undefined,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: {
      ...edgeStyle,
      strokeDasharray: "6 4",
      opacity: 0.85,
    },
    label: "Evolve",
    labelStyle: { fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "color-mix(in oklch, var(--card) 92%, transparent)" },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  },
];

function FitViewWhenReady() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 350 });
    });
    return () => cancelAnimationFrame(t);
  }, [fitView]);
  return null;
}

function FlowInner() {
  return (
    <ReactFlow
      nodes={initialNodes}
      edges={initialEdges}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      minZoom={0.55}
      maxZoom={1.25}
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="color-mix(in oklch, var(--border) 65%, transparent)" />
      <Controls showInteractive={false} />
      <FitViewWhenReady />
    </ReactFlow>
  );
}

/** Live graph for the on-page “Evolutionary workflow” band (read-only). */
export function EvolutionWorkflowFlow() {
  return (
    <div className="h-[360px] max-h-[50vh] min-h-[280px] w-full overflow-hidden rounded-2xl border border-border/60 bg-card/25 shadow-inner">
      <ReactFlowProvider>
        <FlowInner />
      </ReactFlowProvider>
    </div>
  );
}
