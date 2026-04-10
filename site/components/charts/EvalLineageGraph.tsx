"use client";

import Link from "next/link";
import { EVAL_PROJECTS, EVAL_RUNS, type EvalRunRecord } from "@/lib/eval-data";

/**
 * Directed graph showing how greenfield eval runs branch into brownfield
 * evaluations. Renders as a pure SVG with clickable nodes. The layout is
 * top-down: greenfield runs at the top, brownfield branches below with
 * arrows from their baseline run.
 *
 * Per decision gad-90: "represent that as branching like git branching
 * or mermaid graphs, showing how it got the source code for the evaluation."
 */

interface GraphNode {
  id: string; // project/version
  project: string;
  version: string;
  evalMode: string;
  workflow: string;
  score: number | null;
  baseline: { project: string; version: string } | null;
  x: number;
  y: number;
}

const WORKFLOW_COLOR: Record<string, string> = {
  gad: "#38bdf8",
  bare: "#34d399",
  emergent: "#fbbf24",
};

const MODE_LABEL: Record<string, string> = {
  greenfield: "GF",
  brownfield: "BF",
};

function buildGraph(): { nodes: GraphNode[]; edges: Array<{ from: string; to: string }> } {
  const nodes: GraphNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  // Get all runs with scores, grouped by eval_mode
  const greenfield: EvalRunRecord[] = [];
  const brownfield: EvalRunRecord[] = [];

  for (const run of EVAL_RUNS) {
    if (run.evalType === "brownfield") {
      brownfield.push(run);
    } else {
      greenfield.push(run);
    }
  }

  // Get brownfield project baselines from EVAL_PROJECTS
  const baselineMap = new Map<string, { project: string; version: string }>();
  for (const proj of EVAL_PROJECTS) {
    if (proj.baseline && typeof proj.baseline === "object" && "project" in proj.baseline && "version" in proj.baseline) {
      baselineMap.set(proj.id, {
        project: proj.baseline.project as string,
        version: proj.baseline.version as string,
      });
    }
  }

  // Layout: greenfield runs in a row at y=0, brownfield below at y=1
  // Group by project family for x positioning
  const gfByProject = new Map<string, EvalRunRecord[]>();
  for (const r of greenfield) {
    const arr = gfByProject.get(r.project) ?? [];
    arr.push(r);
    gfByProject.set(r.project, arr);
  }

  // Sort each project's runs by version
  for (const arr of gfByProject.values()) {
    arr.sort((a, b) => {
      const av = parseInt(a.version.slice(1), 10) || 0;
      const bv = parseInt(b.version.slice(1), 10) || 0;
      return av - bv;
    });
  }

  // Only show the LATEST greenfield run per project (to keep the graph clean)
  const latestGreenfield: EvalRunRecord[] = [];
  for (const [, runs] of [...gfByProject.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (runs.length > 0) {
      latestGreenfield.push(runs[runs.length - 1]);
    }
  }

  // Position greenfield nodes
  const spacing = 180;
  const startX = 40;

  for (let i = 0; i < latestGreenfield.length; i++) {
    const r = latestGreenfield[i];
    const score = r.humanReviewNormalized?.aggregate_score ?? r.humanReview?.score ?? null;
    nodes.push({
      id: `${r.project}/${r.version}`,
      project: r.project,
      version: r.version,
      evalMode: "greenfield",
      workflow: r.workflow,
      score,
      baseline: null,
      x: startX + i * spacing,
      y: 40,
    });
  }

  // Position brownfield nodes below their baseline
  for (let i = 0; i < brownfield.length; i++) {
    const r = brownfield[i];
    const baseline = baselineMap.get(r.project);
    const score = r.humanReviewNormalized?.aggregate_score ?? r.humanReview?.score ?? null;

    // Find the baseline node's x position
    const baselineNode = baseline
      ? nodes.find((n) => n.project === baseline.project && n.version === baseline.version)
      : null;

    const x = baselineNode ? baselineNode.x + (i % 3) * 60 - 60 : startX + i * spacing;

    nodes.push({
      id: `${r.project}/${r.version}`,
      project: r.project,
      version: r.version,
      evalMode: "brownfield",
      workflow: r.workflow,
      score,
      baseline,
      x,
      y: 160,
    });

    if (baseline) {
      edges.push({
        from: `${baseline.project}/${baseline.version}`,
        to: `${r.project}/${r.version}`,
      });
    }
  }

  return { nodes, edges };
}

function shortName(project: string): string {
  return project
    .replace("escape-the-dungeon-", "etd-")
    .replace("escape-the-dungeon", "etd")
    .replace("etd-brownfield-", "bf-");
}

export function EvalLineageGraph() {
  const { nodes, edges } = buildGraph();

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No eval runs to visualize yet.
      </p>
    );
  }

  // Compute SVG dimensions
  const maxX = Math.max(...nodes.map((n) => n.x)) + 180;
  const maxY = Math.max(...nodes.map((n) => n.y)) + 80;
  const width = Math.max(maxX, 600);
  const height = Math.max(maxY, 240);

  // Node positions for edge drawing
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/30 p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: 500, maxHeight: 300 }}
      >
        {/* Defs for arrowhead */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.4)" />
          </marker>
        </defs>

        {/* Row labels */}
        <text x="4" y="28" fontSize="10" fill="rgba(255,255,255,0.3)" fontWeight="600">
          GREENFIELD
        </text>
        {nodes.some((n) => n.evalMode === "brownfield") && (
          <text x="4" y="148" fontSize="10" fill="rgba(255,255,255,0.3)" fontWeight="600">
            BROWNFIELD
          </text>
        )}

        {/* Edges */}
        {edges.map((e) => {
          const from = nodeMap.get(e.from);
          const to = nodeMap.get(e.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={from.x + 60}
              y1={from.y + 24}
              x2={to.x + 60}
              y2={to.y - 4}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="2"
              strokeDasharray="6 3"
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const color = WORKFLOW_COLOR[node.workflow] ?? "#888";
          const modeTag = MODE_LABEL[node.evalMode] ?? "?";
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={120}
                height={48}
                rx={10}
                fill={`${color}15`}
                stroke={`${color}60`}
                strokeWidth={1.5}
              />
              <text
                x={node.x + 60}
                y={node.y + 18}
                textAnchor="middle"
                fontSize="10"
                fontFamily="monospace"
                fill={color}
                fontWeight="600"
              >
                {shortName(node.project)} {node.version}
              </text>
              <text
                x={node.x + 60}
                y={node.y + 32}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(255,255,255,0.5)"
              >
                {modeTag} · {node.workflow}
                {node.score != null ? ` · ${node.score.toFixed(2)}` : ""}
              </text>
              {/* Badge for mode */}
              <rect
                x={node.x + 92}
                y={node.y - 6}
                width={28}
                height={14}
                rx={4}
                fill={node.evalMode === "brownfield" ? "#a78bfa30" : "#34d39930"}
                stroke={node.evalMode === "brownfield" ? "#a78bfa60" : "#34d39960"}
                strokeWidth={1}
              />
              <text
                x={node.x + 106}
                y={node.y + 4}
                textAnchor="middle"
                fontSize="8"
                fill={node.evalMode === "brownfield" ? "#a78bfa" : "#34d399"}
                fontWeight="600"
              >
                {modeTag}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: "#34d399" }}
          />
          GF = greenfield
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: "#a78bfa" }}
          />
          BF = brownfield (branches from a greenfield run)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-400" />
          GAD
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-400" />
          Bare
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400" />
          Emergent
        </span>
      </div>
    </div>
  );
}
