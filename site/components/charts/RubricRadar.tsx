/**
 * Rubric radar chart — pure SVG polygon with one vertex per dimension.
 *
 * Shows a filled polygon over a gridded background where each axis is a
 * rubric dimension, scaled 0.0 → 1.0 from center to edge. Labels the axes
 * with the dimension label. The fill colour maps to workflow.
 *
 * Component is server-renderable (no client hooks) — the Next.js build
 * emits it as static HTML per run.
 *
 * Caption convention: "Which review dimensions did this run score best and
 * worst?" — per objective-eval-design skill's "questions before charts"
 * discipline (phase 27 task 27-19).
 */

import type { Workflow } from "@/lib/eval-data";

export interface RubricDimension {
  key: string;
  label: string;
  score: number | null;
}

export interface RubricRadarProps {
  dimensions: RubricDimension[];
  workflow: Workflow;
  size?: number;
}

const WORKFLOW_STROKE: Record<Workflow, string> = {
  gad: "#38bdf8",
  bare: "#34d399",
  emergent: "#fbbf24",
};

const WORKFLOW_FILL: Record<Workflow, string> = {
  gad: "rgba(56, 189, 248, 0.18)",
  bare: "rgba(52, 211, 153, 0.18)",
  emergent: "rgba(251, 191, 36, 0.18)",
};

export default function RubricRadar({ dimensions, workflow, size = 360 }: RubricRadarProps) {
  if (dimensions.length < 3) {
    // Radar requires at least 3 vertices to form a polygon.
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-center text-xs text-muted-foreground">
        Rubric radar needs ≥3 dimensions with scores. This run has {dimensions.length}.
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.7;
  const labelRadius = radius * 1.18;
  const n = dimensions.length;

  // Angle per vertex (start at top, go clockwise). 12 o'clock = -π/2.
  const angleFor = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;

  // Concentric grid at 0.25, 0.5, 0.75, 1.0
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  function vertexFor(i: number, score: number) {
    const a = angleFor(i);
    return {
      x: cx + Math.cos(a) * radius * score,
      y: cy + Math.sin(a) * radius * score,
    };
  }

  // Polygon points — when a dimension is unscored, pin to 0 (collapses the point to center).
  const polygonPoints = dimensions
    .map((d, i) => {
      const s = typeof d.score === "number" ? d.score : 0;
      const v = vertexFor(i, s);
      return `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
    })
    .join(" ");

  // Label positions — offset slightly outside the grid.
  const labels = dimensions.map((d, i) => {
    const a = angleFor(i);
    const x = cx + Math.cos(a) * labelRadius;
    const y = cy + Math.sin(a) * labelRadius;
    // Split long labels into two lines at word boundary near middle.
    const words = d.label.split(" ");
    const half = Math.ceil(words.length / 2);
    const line1 = words.slice(0, half).join(" ");
    const line2 = words.slice(half).join(" ");
    return { x, y, line1, line2, key: d.key };
  });

  // Grid polygons at each level
  const gridPolygons = gridLevels.map((level) => {
    const pts = dimensions
      .map((_, i) => {
        const v = vertexFor(i, level);
        return `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
      })
      .join(" ");
    return { level, points: pts };
  });

  // Spokes from center to edge
  const spokes = dimensions.map((_, i) => {
    const edge = vertexFor(i, 1);
    return { x1: cx, y1: cy, x2: edge.x, y2: edge.y };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-md mx-auto" role="img" aria-label="Rubric radar chart">
      {/* Grid polygons */}
      {gridPolygons.map((g) => (
        <polygon
          key={g.level}
          points={g.points}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {/* Spokes */}
      {spokes.map((s, i) => (
        <line
          key={i}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {/* Filled polygon for this run */}
      <polygon
        points={polygonPoints}
        fill={WORKFLOW_FILL[workflow]}
        stroke={WORKFLOW_STROKE[workflow]}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Vertex dots */}
      {dimensions.map((d, i) => {
        const s = typeof d.score === "number" ? d.score : 0;
        const v = vertexFor(i, s);
        return (
          <circle
            key={d.key}
            cx={v.x}
            cy={v.y}
            r={4}
            fill={WORKFLOW_STROKE[workflow]}
            stroke="#0a0a0f"
            strokeWidth={1.5}
          />
        );
      })}
      {/* Grid scale labels on top spoke */}
      {gridLevels.map((level) => (
        <text
          key={`label-${level}`}
          x={cx + 4}
          y={cy - radius * level}
          fontSize="9"
          fill="rgba(255,255,255,0.45)"
          fontFamily="monospace"
        >
          {level.toFixed(2)}
        </text>
      ))}
      {/* Dimension labels */}
      {labels.map((l) => (
        <g key={l.key}>
          <text
            x={l.x}
            y={l.y - (l.line2 ? 5 : 0)}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.85)"
            fontWeight="600"
          >
            {l.line1}
          </text>
          {l.line2 && (
            <text
              x={l.x}
              y={l.y + 8}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255,255,255,0.85)"
              fontWeight="600"
            >
              {l.line2}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
