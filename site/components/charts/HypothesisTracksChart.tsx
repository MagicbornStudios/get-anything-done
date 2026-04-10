"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

/**
 * Interactive line chart showing human-review scores across rounds, broken
 * out by hypothesis track (freedom / CSH / content-driven / GAD baseline).
 * Codex and other runtimes appear as separate series even when they have no
 * data yet — the legend advertises the plan.
 *
 * Task 22-24 from TASK-REGISTRY.xml: "Lightweight SVG charts in a Graphs
 * section on the home page: composite + human review bars per run grouped
 * by workflow, rounds timeline, freedom hypothesis scatter."
 *
 * Adapted: instead of bars, a multi-line chart better shows the cross-round
 * trajectory per hypothesis track that the user asked for on 2026-04-09.
 */

export interface HypothesisTrackPoint {
  round: string;
  freedom: number | null;
  csh: number | null;
  gad: number | null;
  contentDriven: number | null;
  codex: number | null;
}

interface Props {
  data: HypothesisTrackPoint[];
  /** Optional title shown above the chart */
  title?: string;
  /** Optional caption below the chart */
  caption?: string;
}

const STROKE_COLORS: Record<string, string> = {
  freedom: "#10b981", // emerald — bare / freedom hypothesis
  csh: "#f59e0b", // amber — emergent / compound-skills
  gad: "#38bdf8", // sky — GAD full framework
  contentDriven: "#ec4899", // pink — content-driven (queued, no data yet)
  codex: "#a78bfa", // purple — codex runtime comparison (queued, no data yet)
};

const SERIES_LABELS: Record<string, string> = {
  freedom: "Freedom (bare)",
  csh: "CSH (emergent)",
  gad: "GAD framework",
  contentDriven: "Content-driven (planned)",
  codex: "Codex runtime (planned)",
};

export function HypothesisTracksChart({ data, title, caption }: Props) {
  // Find which series actually have data points so we can gate the legend
  const hasData = (key: keyof HypothesisTrackPoint) =>
    data.some((d) => typeof d[key] === "number" && d[key] !== null);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/30 p-5">
      {title && (
        <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
      )}
      {caption && (
        <p className="mb-4 text-xs text-muted-foreground">{caption}</p>
      )}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 20, bottom: 10, left: -10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.08)"
              vertical={false}
            />
            <XAxis
              dataKey="round"
              tick={{ fontSize: 11, fill: "rgba(255, 255, 255, 0.6)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fontSize: 11, fill: "rgba(255, 255, 255, 0.6)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
              label={{
                value: "human review",
                angle: -90,
                position: "insideLeft",
                offset: 20,
                style: { fontSize: 10, fill: "rgba(255, 255, 255, 0.5)" },
              }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(20, 20, 28, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "rgba(255, 255, 255, 0.8)", fontWeight: 600 }}
              formatter={(value: unknown, name: unknown) => {
                const n = typeof name === "string" ? name : String(name);
                if (value == null || typeof value !== "number") {
                  return ["no data", SERIES_LABELS[n] ?? n];
                }
                return [value.toFixed(3), SERIES_LABELS[n] ?? n];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
              iconSize={10}
              formatter={(value) => SERIES_LABELS[value] ?? value}
            />
            {hasData("freedom") && (
              <Line
                type="monotone"
                dataKey="freedom"
                stroke={STROKE_COLORS.freedom}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            )}
            {hasData("csh") && (
              <Line
                type="monotone"
                dataKey="csh"
                stroke={STROKE_COLORS.csh}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            )}
            {hasData("gad") && (
              <Line
                type="monotone"
                dataKey="gad"
                stroke={STROKE_COLORS.gad}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            )}
            {/* Planned tracks rendered as dashed ghost lines for legend presence */}
            {!hasData("contentDriven") && (
              <Line
                type="monotone"
                dataKey="contentDriven"
                stroke={STROKE_COLORS.contentDriven}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            )}
            {!hasData("codex") && (
              <Line
                type="monotone"
                dataKey="codex"
                stroke={STROKE_COLORS.codex}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
        <strong className="text-foreground">Legend:</strong> solid lines show
        rounds with real data. Dashed lines are <em>planned</em> tracks where
        no runs have been scored yet — they exist to make the research plan
        visible. <strong className="text-foreground">Data provenance:</strong>{" "}
        values come from{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">
          EVAL_RUNS[n].humanReviewNormalized.aggregate_score
        </code>
        , grouped by round + workflow at prebuild.
      </p>
    </div>
  );
}
